import { fileURLToPath } from "node:url";

/**
 * Absolute filesystem path to the built web component bundle.
 * `sugarcube studio build` uses this to copy `embed.js` into the output folder.
 */
export const embedPath = fileURLToPath(new URL("./web-component.mjs", import.meta.url));
