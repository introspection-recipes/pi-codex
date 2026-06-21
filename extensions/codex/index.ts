/**
 * codex — OpenAI Codex CLI tool surface as a Pi recipe extension.
 *
 * Pi auto-discovers this via the `extensions/*\/index.ts` glob and registers
 * the gpt-5.5 tool set at session start. gpt-5.5 (codex-rs models.json)
 * advertises `shell_type: "shell_command"` and `apply_patch_tool_type:
 * "freeform"`, so the surface is:
 *
 *   - shell_command   one-shot shell with timeout_ms
 *   - apply_patch     Codex `*** Begin Patch / *** End Patch` envelope
 *   - update_plan     plan tracking with single in-progress invariant
 *   - view_image      load a local image for visual inspection
 *
 * Web search (gpt-5.5 also supports it) lives in the separate, optional
 * extensions/web-search.ts so it can be dropped or reconfigured independently.
 */

import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { shellCommandTool } from "./shell.js";
import { applyPatchTool } from "./apply-patch.js";
import { updatePlanTool } from "./update-plan.js";
import { viewImageTool } from "./view-image.js";

const extension: ExtensionFactory = (pi) => {
  pi.registerTool(shellCommandTool);
  pi.registerTool(applyPatchTool);
  pi.registerTool(updatePlanTool);
  pi.registerTool(viewImageTool);
};

export default extension;
