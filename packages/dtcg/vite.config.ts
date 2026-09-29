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
            {
                test: {
                    name: "custom-type",
                    typecheck: {
                        enabled: true,
                        only: true,
                        include: ["tests/custom-type/*.ts"],
                        tsconfig: "tests/custom-type/tsconfig.json",
                    },
                },
            },
        ],
    },
});
