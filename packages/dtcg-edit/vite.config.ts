import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        typecheck: {
            enabled: true,
            only: true,
            include: ["tests/examples/*.ts"],
            exclude: ["**/*.d.ts"],
            tsconfig: "tests/examples/tsconfig.json",
        },
    },
});
