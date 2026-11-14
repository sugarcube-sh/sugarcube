import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { createPlainAdapter } from "../../src/adapters/plain";
import type { BuildAdapter } from "../../src/controllers/adapter";
import { PLAIN_ENTRY, readPlainFiles } from "./plain-demo";

function readWith(adapter: BuildAdapter) {
    return readFromMemory({ files: readPlainFiles(), entryFile: PLAIN_ENTRY }, adapter.readOptions);
}

describe("plain", () => {
    it("reads a plain DTCG project with dtcg's defaults, finding no problems", () => {
        const tokens = readWith(createPlainAdapter());

        expect(tokens.diagnostics).toEqual([]);
        expect(createPlainAdapter().write(tokens).problems).toEqual([]);
    });

    it("reports what the read finds, as a build would", () => {
        const files = { ...readPlainFiles(), "dark.json": '{ "color": { "text": ' };
        const tokens = readFromMemory(
            { files, entryFile: PLAIN_ENTRY },
            createPlainAdapter().readOptions,
        );

        expect(
            createPlainAdapter()
                .write(tokens)
                .problems.map(({ kind }) => kind),
        ).toContain("invalid-json");
    });

    it("writes a token's value as dtcg writes it, leaving another tool's extensions alone", () => {
        const tokens = readWith(createPlainAdapter());
        const gutter = tokens.getPermutation().getToken("size.fluid.gutter");

        expect(gutter && createPlainAdapter().write(tokens).getValue(gutter)).toBe("2rem");
    });

    it("writes a reference as the value it reaches in the theme asked about", () => {
        const tokens = readWith(createPlainAdapter());
        const text = tokens.getPermutation({ mode: "dark" }).getToken("color.text.default");

        expect(text && createPlainAdapter().write(tokens).getValue(text)).toBe(
            "oklch(0.986 0.002 258)",
        );
    });

    it("writes only the default theme on :root when given no blocks", () => {
        const tokens = readWith(createPlainAdapter());
        const { css } = createPlainAdapter().write(tokens);

        expect(css).toContain(":root {");
        expect(css).toContain("--size-fluid-gutter: 2rem;");
        expect(css).toContain("--color-text-default: var(--color-neutral-900);");
        expect(css).not.toContain("[data-mode");
    });

    it("writes the blocks it is given, each theme under its own selector", () => {
        const tokens = readWith(createPlainAdapter());
        const { css } = createPlainAdapter({
            blocks: [
                { input: {}, selector: ":root" },
                { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
            ],
        }).write(tokens);

        expect(css).toContain('[data-mode="dark"] {');
        expect(css).toContain("--color-text-default: var(--color-neutral-50);");
    });

    it("names variables with the naming it is given", () => {
        const tokens = readWith(createPlainAdapter());
        const { css } = createPlainAdapter({ naming: { prefix: "ds" } }).write(tokens);

        expect(css).toContain("--ds-size-fluid-gutter: 2rem;");
        expect(css).toContain("var(--ds-color-neutral-900)");
    });
});
