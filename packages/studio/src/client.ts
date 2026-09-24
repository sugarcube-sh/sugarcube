import { fileURLToPath } from "node:url";

/**
 * Absolute filesystem path to the built Studio SPA assets.
 * Integrations (studio-vite, studio-node) hand this to a static file server.
 */
export const clientPath = fileURLToPath(new URL("./client", import.meta.url));

/** The script the hub imports into a page Studio is docked on. Built self-contained. */
export const pageScriptPath = fileURLToPath(new URL("./page-script.mjs", import.meta.url));
