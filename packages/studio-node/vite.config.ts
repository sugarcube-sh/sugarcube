import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        root: fileURLToPath(new URL(".", import.meta.url)),
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
