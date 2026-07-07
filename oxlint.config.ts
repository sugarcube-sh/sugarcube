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
});
