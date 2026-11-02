import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { plain } from "../../src/adapters/plain";
import type { BuildAdapter } from "../../src/controllers/adapter";
import { PLAIN_ENTRY, plainFiles } from "./plain-demo";

function readWith(adapter: BuildAdapter) {
    return readFromMemory({ files: plainFiles(), entryFile: PLAIN_ENTRY }, adapter.read);
}

describe("plain", () => {
    it("reads a plain DTCG project with dtcg's defaults, finding no problems", () => {
        const tokens = readWith(plain());

        expect(tokens.diagnostics).toEqual([]);
        expect(plain().write(tokens).problems).toEqual([]);
    });

    it("reports what the read finds, as a build would", () => {
        const files = { ...plainFiles(), "dark.json": '{ "color": { "text": ' };
        const tokens = readFromMemory({ files, entryFile: PLAIN_ENTRY }, plain().read);

        expect(
            plain()
                .write(tokens)
                .problems.map(({ kind }) => kind),
        ).toContain("invalid-json");
    });

    it("writes a token's value as dtcg writes it, leaving another tool's extensions alone", () => {
        const tokens = readWith(plain());
        const gutter = tokens.getPermutation().getToken("size.fluid.gutter");

        expect(gutter && plain().write(tokens).value(gutter)).toBe("2rem");
    });

    it("writes a reference as the value it reaches in the theme asked about", () => {
        const tokens = readWith(plain());
        const text = tokens.getPermutation({ mode: "dark" }).getToken("color.text.default");

        expect(text && plain().write(tokens).value(text)).toBe("oklch(0.986 0.002 258)");
    });

    it("writes only the default theme on :root when given no blocks", () => {
        const tokens = readWith(plain());
        const { css } = plain().write(tokens);

        expect(css).toContain(":root {");
        expect(css).toContain("--size-fluid-gutter: 2rem;");
        expect(css).toContain("--color-text-default: var(--color-neutral-900);");
        expect(css).not.toContain("[data-mode");
    });

    it("writes the blocks it is given, each theme under its own selector", () => {
        const tokens = readWith(plain());
        const { css } = plain({
            blocks: [
                { input: {}, selector: ":root" },
                { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
            ],
        }).write(tokens);

        expect(css).toContain('[data-mode="dark"] {');
        expect(css).toContain("--color-text-default: var(--color-neutral-50);");
    });

    it("names variables with the naming it is given", () => {
        const tokens = readWith(plain());
        const { css } = plain({ naming: { prefix: "ds" } }).write(tokens);

        expect(css).toContain("--ds-size-fluid-gutter: 2rem;");
        expect(css).toContain("var(--ds-color-neutral-900)");
    });
});
