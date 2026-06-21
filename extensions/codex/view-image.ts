/**
 * Codex `view_image` tool — port of create_view_image_tool
 * (codex-rs/core/src/tools/handlers/view_image_spec.rs).
 *
 * Loads a local image file from the workspace and returns it as an image
 * content block so the model can visually inspect it.
 */

import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { Type, type Static } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { safePath } from "../lib/safe-path.js";

const ViewImageParams = Type.Object({
  path: Type.String({
    description: "Local filesystem path to an image file.",
  }),
});

type ViewImageInput = Static<typeof ViewImageParams>;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

export const viewImageTool = defineTool({
  name: "view_image",
  label: "View Image",
  description:
    "View a local image file from the filesystem when visual inspection is needed. " +
    "Use this for images already available on disk.",
  parameters: ViewImageParams,
  execute: async (_id, params: ViewImageInput) => {
    const path = safePath(process.cwd(), params.path);
    const mimeType = MIME_BY_EXT[extname(path).toLowerCase()];
    if (!mimeType) {
      throw new Error(
        `Unsupported image type: ${params.path}. Supported: ${Object.keys(
          MIME_BY_EXT
        ).join(", ")}.`
      );
    }
    const data = readFileSync(path).toString("base64");
    return {
      content: [
        { type: "image" as const, data, mimeType },
        { type: "text" as const, text: `Loaded image ${params.path}` },
      ],
      details: { path: resolve(path), mimeType },
    };
  },
});
