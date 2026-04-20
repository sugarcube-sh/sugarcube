import { fileURLToPath } from "node:url";

/**
 * Absolute filesystem path to the built Studio SPA assets.
 * Integrations (studio-vite, studio-node) hand this to a static file server.
 */
export const clientPath = fileURLToPath(new URL("./client", import.meta.url));
