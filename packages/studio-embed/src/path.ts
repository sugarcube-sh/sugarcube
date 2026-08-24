import { fileURLToPath } from "node:url";

export const embedPath = fileURLToPath(new URL("./web-component.mjs", import.meta.url));
