/**
 * codex — OpenAI Codex CLI tool surface as a Pi recipe extension.
 *
 * Pi auto-discovers this via the `extensions/*\/index.ts` glob and registers
 * the current Codex-style tool set at session start:
 *
 *   - exec_command    yielding command execution with reusable sessions
 *   - write_stdin     input and polling for running sessions
 *   - apply_patch     Codex `*** Begin Patch / *** End Patch` envelope
 *   - update_plan     plan tracking with single in-progress invariant
 *   - view_image      load a local image for visual inspection
 *   - request_user_input portable structured user interaction
 *
 * Web search lives in the separate, optional extensions/web-search.ts so it
 * can be dropped or reconfigured independently.
 */

import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { applyPatchTool } from "./apply-patch.js";
import { requestUserInputTool } from "./request-user-input.js";
import { createUnifiedExecTools } from "./unified-exec.js";
import { updatePlanTool } from "./update-plan.js";
import { viewImageTool } from "./view-image.js";

const extension: ExtensionFactory = (pi) => {
  const exec = createUnifiedExecTools();
  pi.registerTool(exec.execCommandTool);
  pi.registerTool(exec.writeStdinTool);
  pi.registerTool(applyPatchTool);
  pi.registerTool(updatePlanTool);
  pi.registerTool(viewImageTool);
  pi.registerTool(requestUserInputTool);
  pi.on("session_shutdown", () => exec.closeAll());
};

export default extension;
