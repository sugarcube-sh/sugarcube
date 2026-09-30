import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["tests/**/*.test.ts"],
                },
            },
            {
                test: {
                    name: "unit-types",
                    typecheck: {
                        enabled: true,
                        only: true,
                        include: ["tests/**/*.test.ts"],
                        tsconfig: "tests/tsconfig.json",
                    },
                },
            },
            {
                test: {
                    name: "examples",
                    typecheck: {
                        enabled: true,
                        only: true,
                        include: ["tests/examples/*.ts"],
                        exclude: ["**/*.d.ts"],
                        tsconfig: "tests/examples/tsconfig.json",
                    },
                },
            },
        ],
    },
});
