import { fileURLToPath } from "node:url";

/** The built studio web app, for integrations to serve statically. */
export const clientPath = fileURLToPath(new URL("./client", import.meta.url));

/** The script the dock injects into the page studio is mounted on. */
export const pageScriptPath = fileURLToPath(
    new URL("./page-script/page-script.mjs", import.meta.url),
);
