import { fileURLToPath } from "node:url";

/**
 * Absolute filesystem path to the built web component bundle.
 *
 * Tooling (notably `sugarcube studio build`) uses this to copy the
 * bundle into a consumer's static-output folder as `embed.js`.
 */
export const embedPath = fileURLToPath(new URL("./web-component.mjs", import.meta.url));
