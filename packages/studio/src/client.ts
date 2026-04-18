import { fileURLToPath } from "node:url";

/**
 * Absolute filesystem path to the built Studio SPA assets.
 *
 * Integrations (studio-vite, studio-node, etc.) hand this path to a
 * static file server (sirv, express.static, etc.) to serve the client
 * at their chosen URL prefix.
 */
export const clientPath = fileURLToPath(new URL("./client", import.meta.url));
