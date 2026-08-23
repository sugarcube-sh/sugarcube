import { defineConfig } from "oxlint";

export default defineConfig({
    plugins: ["typescript", "react", "jsx-a11y", "import", "unicorn", "oxc"],
    jsPlugins: ["eslint-plugin-regexp"],
    categories: {
        correctness: "error",
        suspicious: "warn",
        perf: "warn",
    },
    rules: {
        "no-await-in-loop": "off",
        "unicorn/consistent-function-scoping": "off",
        "unicorn/no-array-sort": "off",
        "unicorn/prefer-set-has": "off",
        "import/no-unassigned-import": "off",
        "import/no-named-as-default": "off",
        "react/react-in-jsx-scope": "off",
        "regexp/no-super-linear-backtracking": "error",
        "regexp/no-super-linear-move": "error",
    },
    env: {
        builtin: true,
    },
    overrides: [
        {
            // Controls are presentational: props in, callback out. Keeping store access out
            // is what lets them be re-hosted (embedded mode, docs, tests) without a provider.
            files: ["packages/studio/src/components/controls/**"],
            rules: {
                "no-restricted-imports": [
                    "error",
                    {
                        patterns: [
                            {
                                group: ["**/store", "**/store/**"],
                                message:
                                    "components/controls must stay presentational — take props and emit callbacks instead of reading the store.",
                            },
                            {
                                group: ["**/rows", "**/rows/**"],
                                message:
                                    "components/controls must not depend on the row layer — a control renders props, it doesn't know about bindings or rows. Shared data shapes belong in tokens/.",
                            },
                        ],
                    },
                ],
            },
        },
    ],
});
