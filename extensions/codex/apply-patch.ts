/**
 * Codex `apply_patch` tool.
 *
 * gpt-5.5 exposes apply_patch as a `freeform` tool whose body is the Codex
 * patch envelope. The Pi tool API is JSON-shaped, so we accept the same
 * envelope as a single `patch` string and parse it here.
 *
 * Envelope (codex-rs/prompts/templates/apply_patch_tool_instructions.md):
 *   *** Begin Patch
 *   *** Add File: <path>      (every following line is a `+` line)
 *   *** Delete File: <path>
 *   *** Update File: <path>   (optional `*** Move to: <path>`, then @@ hunks)
 *   *** End Patch
 * Update hunk lines start with ` ` (context), `-` (removed), or `+` (added).
 *
 * Every write is planned up front to preserve atomicity: if any hunk fails,
 * the original file contents are restored.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { Type, type Static } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { safePath } from "../lib/safe-path.js";

const ApplyPatchParams = Type.Object({
  patch: Type.String({
    description:
      "The full patch. Must start with `*** Begin Patch` and end with `*** End Patch`. " +
      "Use `*** Add File:`, `*** Delete File:`, or `*** Update File:` sections; " +
      "Update sections may include `*** Move to:` and `@@` hunks with lines prefixed by ` `, `-`, or `+`.",
  }),
});

type ApplyPatchInput = Static<typeof ApplyPatchParams>;

type PatchAction =
  | { type: "add"; path: string; lines: string[] }
  | { type: "delete"; path: string }
  | { type: "update"; path: string; moveTo?: string; lines: string[] };

interface PlannedWrite {
  content: string | null;
  label: string;
  report: boolean;
}

function parsePatch(patch: string): PatchAction[] {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "*** Begin Patch") {
    throw new Error("Patch must start with *** Begin Patch");
  }
  const endIndex = lines.findIndex((line) => line === "*** End Patch");
  if (endIndex === -1) throw new Error("Patch must end with *** End Patch");

  const actions: PatchAction[] = [];
  let i = 1;
  while (i < endIndex) {
    const line = lines[i];
    if (line.startsWith("*** Add File: ")) {
      const path = line.slice("*** Add File: ".length);
      const body: string[] = [];
      i++;
      while (i < endIndex && !lines[i].startsWith("*** ")) {
        if (!lines[i].startsWith("+")) {
          throw new Error(`Add file lines must start with +: ${lines[i]}`);
        }
        body.push(lines[i].slice(1));
        i++;
      }
      actions.push({ type: "add", path, lines: body });
      continue;
    }
    if (line.startsWith("*** Delete File: ")) {
      actions.push({
        type: "delete",
        path: line.slice("*** Delete File: ".length),
      });
      i++;
      continue;
    }
    if (line.startsWith("*** Update File: ")) {
      const path = line.slice("*** Update File: ".length);
      let moveTo: string | undefined;
      const body: string[] = [];
      i++;
      if (i < endIndex && lines[i].startsWith("*** Move to: ")) {
        moveTo = lines[i].slice("*** Move to: ".length);
        i++;
      }
      while (i < endIndex && !lines[i].startsWith("*** ")) {
        body.push(lines[i]);
        i++;
      }
      actions.push({ type: "update", path, moveTo, lines: body });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    throw new Error(`Unexpected patch line: ${line}`);
  }
  return actions;
}

function findSequence(
  haystack: string[],
  needle: string[],
  start: number
): number {
  if (needle.length === 0) return -1;
  for (let i = start; i <= haystack.length - needle.length; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

function applyUpdate(original: string, patchLines: string[]): string {
  const hadTrailingNewline = original.endsWith("\n");
  let content = original.replace(/\n$/, "").split("\n");
  if (content.length === 1 && content[0] === "") content = [];

  let cursor = 0;
  let i = 0;
  while (i < patchLines.length) {
    if (patchLines[i].startsWith("@@")) {
      i++;
      continue;
    }
    const oldLines: string[] = [];
    const newLines: string[] = [];
    while (i < patchLines.length && !patchLines[i].startsWith("@@")) {
      const line = patchLines[i];
      if (line.startsWith(" ")) {
        oldLines.push(line.slice(1));
        newLines.push(line.slice(1));
      } else if (line.startsWith("-")) {
        oldLines.push(line.slice(1));
      } else if (line.startsWith("+")) {
        newLines.push(line.slice(1));
      } else if (line === "\\ No newline at end of file") {
        // marker — no effect in this lightweight parser
      } else if (line.trim() !== "") {
        throw new Error(
          `Update hunk lines must start with space, -, +, or @@: ${line}`
        );
      }
      i++;
    }
    const index = findSequence(content, oldLines, cursor);
    if (index === -1) {
      throw new Error(
        oldLines.length === 0
          ? "Insertion-only update hunks require context"
          : "Could not find update hunk context"
      );
    }
    content.splice(index, oldLines.length, ...newLines);
    cursor = index + newLines.length;
  }
  return content.join("\n") + (hadTrailingNewline ? "\n" : "");
}

function snapshot(
  path: string,
  planned: Map<string, PlannedWrite>
): string | null {
  const plannedWrite = planned.get(path);
  if (plannedWrite) return plannedWrite.content;
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function planPatch(actions: PatchAction[]): Map<string, PlannedWrite> {
  const cwd = process.cwd();
  const planned = new Map<string, PlannedWrite>();
  for (const action of actions) {
    const path = safePath(cwd, action.path);
    const current = snapshot(path, planned);
    if (action.type === "add") {
      if (current !== null)
        throw new Error(`File already exists: ${action.path}`);
      planned.set(path, {
        content: `${action.lines.join("\n")}\n`,
        label: `A ${action.path}`,
        report: true,
      });
      continue;
    }
    if (action.type === "delete") {
      if (current === null)
        throw new Error(`File does not exist: ${action.path}`);
      planned.set(path, {
        content: null,
        label: `D ${action.path}`,
        report: true,
      });
      continue;
    }
    if (current === null)
      throw new Error(`File does not exist: ${action.path}`);
    const next =
      action.lines.length > 0 ? applyUpdate(current, action.lines) : current;
    if (action.moveTo) {
      const outputPath = safePath(cwd, action.moveTo);
      if (snapshot(outputPath, planned) !== null && outputPath !== path) {
        throw new Error(`File already exists: ${action.moveTo}`);
      }
      planned.set(outputPath, {
        content: next,
        label: `R ${action.path} -> ${action.moveTo}`,
        report: true,
      });
      if (outputPath !== path) {
        planned.set(path, {
          content: null,
          label: `D ${action.path}`,
          report: false,
        });
      }
    } else {
      planned.set(path, {
        content: next,
        label: `M ${action.path}`,
        report: true,
      });
    }
  }
  return planned;
}

function commitPlan(planned: Map<string, PlannedWrite>): string[] {
  const backups = new Map<string, string | null>();
  for (const path of planned.keys()) {
    backups.set(path, existsSync(path) ? readFileSync(path, "utf8") : null);
  }
  try {
    for (const [path, write] of planned) {
      if (write.content === null) {
        if (existsSync(path)) unlinkSync(path);
      } else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, write.content);
      }
    }
  } catch (err) {
    for (const [path, content] of backups) {
      if (content === null) {
        if (existsSync(path)) unlinkSync(path);
      } else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
    }
    throw err;
  }
  return [...planned.values()].filter((w) => w.report).map((w) => w.label);
}

export const applyPatchTool = defineTool({
  name: "apply_patch",
  label: "Apply Patch",
  description:
    "Use the `apply_patch` tool to edit files.\n" +
    "The patch must start with `*** Begin Patch` and end with `*** End Patch`.\n" +
    "Supported sections are `*** Add File:`, `*** Delete File:`, and `*** Update File:` " +
    "(with optional `*** Move to:` and `@@` hunks whose lines start with ` `, `-`, or `+`).",
  parameters: ApplyPatchParams,
  execute: async (_id, params: ApplyPatchInput) => {
    const actions = parsePatch(params.patch);
    const touched = commitPlan(planPatch(actions));
    return {
      content: [
        {
          type: "text" as const,
          text: `Success. Updated the following files:\n${touched.join("\n")}`,
        },
      ],
      details: { files: touched },
    };
  },
});
