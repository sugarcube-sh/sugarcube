import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@sugarcube-sh\/core$/,
                replacement: fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
            },
        ],
    },
});
