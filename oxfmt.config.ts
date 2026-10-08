import { defineConfig } from "oxfmt";

export default defineConfig({
    tabWidth: 4,
    quoteProps: "consistent",
    ignorePatterns: [
        "**/*.md",
        "**/*.mdx",
        "apps/www/public/r/**",
        // Intentionally malformed fixture; must not be "fixed".
        "packages/core/tests/__fixtures__/tokens/invalid-json.json",
        // Spec case inputs are exact bytes; offsets in expected.json depend on them.
        "packages/dtcg/tests/read/cases/*/input/**",
        "packages/cli/tests/__golden__/**",
        // Common mistakes, some not valid JSON; positions in the golden output depend on them.
        "packages/cli/tests/__fixtures__/mistakes/**",
    ],
    overrides: [
        {
            files: ["**/*.json", "**/*.jsonc", "**/*.toml", "**/*.yml", "**/*.yaml"],

            options: { tabWidth: 2 },
        },
    ],
});
