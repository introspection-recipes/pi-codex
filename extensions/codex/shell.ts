/**
 * Codex `shell_command` tool — gpt-5.5's shell.
 *
 * gpt-5.5 advertises `shell_type: "shell_command"` (codex-rs models.json):
 * a one-shot command runner, not the unified exec_command/write_stdin
 * session pair used by some other model families. This is a faithful port
 * of `create_shell_command_tool` (codex-rs/core/src/tools/handlers/shell_spec.rs):
 * a `command` run in the user's default shell with a `timeout_ms`, returning
 * combined stdout+stderr.
 *
 * Output is truncated at standard Pi limits, with the full transcript spilled
 * to a temp file the agent can read back when output is large.
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { Type, type Static } from "typebox";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  defineTool,
  formatSize,
  getShellConfig,
  truncateTail,
  type ToolDefinition,
  type TruncationResult,
} from "@earendil-works/pi-coding-agent";

const DEFAULT_TIMEOUT_MS = 10_000;

const ShellCommandParams = Type.Object({
  command: Type.String({
    description: "Shell script to run in the user's default shell.",
  }),
  workdir: Type.Optional(
    Type.String({
      description: "Working directory for the command. Defaults to the turn cwd.",
    })
  ),
  timeout_ms: Type.Optional(
    Type.Number({
      description: "Maximum command runtime. Defaults to 10000 ms.",
    })
  ),
  login: Type.Optional(
    Type.Boolean({
      description:
        "True runs with login shell semantics; false disables them. Defaults to true.",
    })
  ),
});

type ShellCommandInput = Static<typeof ShellCommandParams>;

interface ShellDetails {
  exit_code?: number | null;
  timed_out?: boolean;
  truncation?: TruncationResult;
  fullOutputPath?: string;
}

function getTempFilePath(): string {
  return join(tmpdir(), `codex-shell-${randomBytes(8).toString("hex")}.log`);
}

function killProcessTree(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already exited
    }
  }
}

function shellArgs(
  command: string,
  login: boolean | undefined
): { shell: string; args: string[] } {
  const config = getShellConfig();
  if (login === false) {
    return { shell: config.shell, args: ["-c", command] };
  }
  return { shell: config.shell, args: [...config.args, command] };
}

export const shellCommandTool: ToolDefinition<
  typeof ShellCommandParams,
  ShellDetails
> = defineTool({
  name: "shell_command",
  label: "Shell",
  description:
    "Runs a shell command and returns its output.\n" +
    "- Always set the `workdir` param when using the shell_command function. Do not use `cd` unless absolutely necessary.",
  parameters: ShellCommandParams,
  execute: async (_id, params: ShellCommandInput, signal) => {
    const cwd = resolve(params.workdir ?? process.cwd());
    if (!existsSync(cwd)) {
      throw new Error(`Working directory does not exist: ${cwd}`);
    }
    const { shell, args } = shellArgs(params.command, params.login);
    const child = spawn(shell, args, {
      cwd,
      detached: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let tempFilePath: string | undefined;
    let droppedBytes = 0;
    const appendOutput = (data: Buffer) => {
      totalBytes += data.length;
      if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
        tempFilePath = getTempFilePath();
        writeFileSync(tempFilePath, Buffer.concat(chunks));
      }
      if (tempFilePath) appendFileSync(tempFilePath, data);
      chunks.push(data);
      // Bound the in-memory retention; the temp file keeps the full transcript.
      while (
        Buffer.concat(chunks).length > DEFAULT_MAX_BYTES * 2 &&
        chunks.length > 1
      ) {
        const removed = chunks.shift()!;
        droppedBytes += removed.length;
      }
    };
    child.stdout.on("data", (d: Buffer) => appendOutput(d));
    child.stderr.on("data", (d: Buffer) => appendOutput(d));

    const timeoutMs = params.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    let timedOut = false;

    const exitCode = await new Promise<number | null>((resolveExit) => {
      let settled = false;
      const finish = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolveExit(code);
      };
      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) killProcessTree(child.pid);
        finish(null);
      }, timeoutMs);
      const onAbort = () => {
        if (child.pid) killProcessTree(child.pid);
        finish(null);
      };
      if (signal?.aborted) onAbort();
      signal?.addEventListener("abort", onAbort, { once: true });
      child.on("error", () => finish(null));
      child.on("close", (code) => finish(code));
    });

    const retained = Buffer.concat(chunks).toString("utf-8");
    const truncation = truncateTail(retained, {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES,
    });
    let text = truncation.content || "(no output)";
    const details: ShellDetails = { exit_code: exitCode, timed_out: timedOut };

    if (truncation.truncated || droppedBytes > 0) {
      if (!tempFilePath) {
        tempFilePath = getTempFilePath();
        writeFileSync(tempFilePath, retained);
      }
      details.truncation = truncation;
      details.fullOutputPath = tempFilePath;
      text += `\n\n[Output truncated (${formatSize(
        Buffer.byteLength(retained, "utf-8")
      )} retained). Full output: ${tempFilePath}]`;
    }

    if (timedOut) {
      throw new Error(`${text}\n\nCommand timed out after ${timeoutMs} ms`);
    }
    if (exitCode !== 0 && exitCode !== null) {
      throw new Error(`${text}\n\nCommand exited with code ${exitCode}`);
    }
    return { content: [{ type: "text" as const, text }], details };
  },
});
