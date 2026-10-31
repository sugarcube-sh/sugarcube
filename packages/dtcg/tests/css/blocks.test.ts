import { describe, expect, it } from "vitest";
import {
    type CSSBlock,
    type CSSBlockInput,
    type CSSWriterOptions,
    cssBlocks,
    cssText,
    cssWriter,
} from "../../src/css.js";
import { type DesignTokens, PermutationError, readFromMemory } from "../../src/index.js";

const px = (value: number) => ({ value, unit: "px" });
const color = (value: unknown) => ({ $type: "color", $value: value });

function read(files: Record<string, unknown>): DesignTokens {
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    return readFromMemory({ files: texts }, { hexStringColors: true });
}

function themed(base: Record<string, unknown>, dark: Record<string, unknown>): DesignTokens {
    return read({
        "tokens.resolver.json": {
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                {
                    type: "modifier",
                    name: "mode",
                    default: "light",
                    contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                },
            ],
        },
        "base.json": base,
        "dark.json": dark,
    });
}

const palette = {
    color: {
        $type: "color",
        ink: { $value: "#111111" },
        paper: { $value: "#ffffff" },
        text: { $value: "{color.ink}" },
        quote: { $value: "{color.text}" },
    },
    gap: { $type: "dimension", $value: px(8) },
};
const tokens = themed(palette, { color: { ink: { $value: "#eeeeee" } } });

const root = { input: {}, selector: ":root" };
const dark = { input: { mode: "dark" }, selector: '[data-mode="dark"]' };

function written(block: CSSBlock | undefined): string[] {
    return block?.inRule.map(({ name, value }) => `${name}: ${value}`) ?? [];
}

describe("cssBlocks", () => {
    it("writes a first block in full", () => {
        const [first] = cssBlocks(tokens, [root]);
        expect(written(first)).toStrictEqual([
            "--color-ink: #111111",
            "--color-paper: #ffffff",
            "--color-text: var(--color-ink)",
            "--color-quote: var(--color-text)",
            "--gap: 8px",
        ]);
    });

    it("writes only what differs from an earlier block reaching it, then what refers to that, through every step", () => {
        const [, later] = cssBlocks(tokens, [root, dark]);
        expect(written(later)).toStrictEqual([
            "--color-ink: #eeeeee",
            "--color-text: var(--color-ink)",
            "--color-quote: var(--color-text)",
        ]);
    });

    it("writes only what differs when told not to write what refers to it again", () => {
        const [, later] = cssBlocks(tokens, [root, { ...dark, redeclare: false }]);
        expect(written(later)).toStrictEqual(["--color-ink: #eeeeee"]);
    });

    it("writes again what a value names through write, not only through a reference", () => {
        const mixed = themed(
            { ...palette, shade: color("#000000") },
            { color: { ink: { $value: "#eeeeee" } } },
        );
        const ink = mixed.permutation().token("color.ink");
        const writer = cssWriter({
            value: (token, { written: value, write }) =>
                token.path === "shade" && ink
                    ? write`color-mix(in oklch, ${ink} 50%, black)`
                    : value,
        });
        const [, later] = cssBlocks(mixed, [root, dark], { writer });
        expect(written(later)).toContain(
            "--shade: color-mix(in oklch, var(--color-ink) 50%, black)",
        );
    });

    it("gives each block the declarations of the theme its input names, from the writer", () => {
        const writer = cssWriter();
        const [, later] = cssBlocks(tokens, [root, dark], { writer });
        expect(later?.declarations).toBe(
            writer.declarations(tokens.permutation({ mode: "dark" })).declarations,
        );
    });

    it("throws the read's PermutationError for an input naming a theme the tokens don't have", () => {
        expect(() => cssBlocks(tokens, [{ input: { mode: "dim" }, selector: ".dim" }])).toThrow(
            PermutationError,
        );
    });

    describe("which earlier blocks reach a later one", () => {
        const inFull = cssWriter().declarations(tokens.permutation(dark.input)).declarations.length;
        const reachedBy = (earlier: Partial<CSSBlockInput>, later: Partial<CSSBlockInput>) => {
            const [, block] = cssBlocks(tokens, [
                { ...root, ...earlier },
                { ...dark, selector: ".later", ...later },
            ]);
            return written(block).length < inFull;
        };

        it("is reached by :root, since custom properties inherit from it", () => {
            expect(reachedBy({ selector: ":root" }, { selector: ".theme" })).toBe(true);
        });

        it("is reached by a block naming every selector it has", () => {
            expect(reachedBy({ selector: [".a", ".b"] }, { selector: ".a" })).toBe(true);
            expect(reachedBy({ selector: ".a" }, { selector: [".a", ".b"] })).toBe(false);
        });

        it("is not reached by another selector, so it is written in full", () => {
            expect(reachedBy({ selector: ".a" }, { selector: ".b" })).toBe(false);
        });

        it("is reached by a block with no at-rule, or the same ones", () => {
            expect(reachedBy({}, { atRules: ["@media (min-width: 640px)"] })).toBe(true);
            expect(
                reachedBy(
                    { atRules: ["@media print"] },
                    { selector: ":root", atRules: ["@media print"] },
                ),
            ).toBe(true);
        });

        it("is reached by a media query every screen it covers also matches", () => {
            const min = (width: number) => [`@media (min-width: ${width}px)`];
            expect(reachedBy({ atRules: min(640) }, { atRules: min(1024) })).toBe(true);
            expect(reachedBy({ atRules: min(1024) }, { atRules: min(640) })).toBe(false);
            expect(reachedBy({ atRules: min(640) }, {})).toBe(false);
        });

        it("is not reached when it cannot be sure, so it is written in full", () => {
            expect(reachedBy({ atRules: ["@media print"] }, { atRules: ["@media screen"] })).toBe(
                false,
            );
            expect(
                reachedBy(
                    { atRules: ["@media (min-width: 640px)", "@supports (color: red)"] },
                    { atRules: ["@media (min-width: 1024px)"] },
                ),
            ).toBe(false);
        });
    });

    describe("@supports", () => {
        const p3 = { colorSpace: "display-p3", components: [1, 0, 0], hex: "#ff0000" };
        const fallback: CSSWriterOptions["fallback"] = (token, { writtenWith }) => {
            const hex = token.type === "color" ? writtenWith({ colors: "hex" }) : undefined;
            return hex && { written: hex, unless: "(color: color(display-p3 1 1 1))" };
        };
        const wide = themed(
            { brand: color(p3) },
            { brand: color({ ...p3, components: [0, 1, 0], hex: "#ff0000" }) },
        );

        it("writes a line again only under @supports when only what is supported changes", () => {
            const [first, later] = cssBlocks(wide, [root, dark], {
                writer: cssWriter({ fallback }),
            });
            expect(first?.underSupports.map(({ name }) => name)).toStrictEqual(["--brand"]);
            expect(written(later)).toStrictEqual([]);
            expect(later?.underSupports.map(({ supports }) => supports)).toStrictEqual([
                [
                    {
                        condition: "(color: color(display-p3 1 1 1))",
                        value: "color(display-p3 0 1 0)",
                    },
                ],
            ]);
        });
    });
});

describe("cssBlocks, the modifiers a block's input names", () => {
    const brands = read({
        "tokens.resolver.json": {
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                {
                    type: "modifier",
                    name: "mode",
                    default: "light",
                    contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                },
                {
                    type: "modifier",
                    name: "brand",
                    default: "a",
                    contexts: { a: [], b: [{ $ref: "b.json" }] },
                },
            ],
        },
        "base.json": {
            surface: color("#ffffff"),
            primary: color("#ff0000"),
            button: color("{primary}"),
        },
        "dark.json": { surface: color("#000000"), primary: color("#880000") },
        "b.json": { primary: color("#ff0000") },
    });
    const block = (input: Record<string, string>, selector: string) => ({ input, selector });
    const rootBlock = block({}, ":root");
    const darkBlock = block({ mode: "dark" }, '[data-mode="dark"]');

    it("knows which modifier writes each token, from the context listing the file", () => {
        const surface = brands.permutation({ mode: "dark" }).token("surface");
        expect(surface?.writtenAt.map(({ source }) => source.modifier?.name)).toStrictEqual([
            undefined,
            "mode",
        ]);
    });

    describe("a block whose input names some modifiers stacks with the others", () => {
        it("writes every token its modifiers provide a value for, even when it equals the default, when another block that might apply says otherwise, and what refers to it", () => {
            const [, , brand] = cssBlocks(brands, [
                rootBlock,
                darkBlock,
                block({ brand: "b" }, '[data-brand="b"]'),
            ]);
            expect(written(brand)).toStrictEqual([
                "--primary: #ff0000",
                "--button: var(--primary)",
            ]);
        });

        it("leaves out what its modifiers provide no value for, so the themes stack on one element", () => {
            const [, , brand] = cssBlocks(brands, [
                rootBlock,
                darkBlock,
                block({ brand: "b" }, '[data-brand="b"]'),
            ]);
            expect(written(brand).some((line) => line.startsWith("--surface"))).toBe(false);
        });

        it("writes the default's values for its modifier where another block changed them, so a light section in a dark page is light", () => {
            const [, , lightBlock] = cssBlocks(brands, [
                rootBlock,
                darkBlock,
                block({ mode: "light" }, '[data-mode="light"]'),
            ]);
            expect(written(lightBlock)).toStrictEqual([
                "--surface: #ffffff",
                "--primary: #ff0000",
                "--button: var(--primary)",
            ]);
        });

        it("writes what a combined block's modifiers provide values for, so it wins over either alone", () => {
            const [, , , both] = cssBlocks(brands, [
                rootBlock,
                darkBlock,
                block({ brand: "b" }, '[data-brand="b"]'),
                block({ mode: "dark", brand: "b" }, '[data-mode="dark"][data-brand="b"]'),
            ]);
            expect(written(both)).toStrictEqual([
                "--surface: #000000",
                "--primary: #ff0000",
                "--button: var(--primary)",
            ]);
        });

        it("matches its modifiers' names as inputs are matched, in any case", () => {
            const [, , brand] = cssBlocks(brands, [
                rootBlock,
                darkBlock,
                block({ Brand: "b" }, '[data-brand="b"]'),
            ]);
            expect(written(brand)).toStrictEqual([
                "--primary: #ff0000",
                "--button: var(--primary)",
            ]);
        });
    });

    describe("a block whose input names every modifier stands alone", () => {
        it("writes every value another block that might apply contradicts", () => {
            const [, , brand] = cssBlocks(brands, [
                block({ mode: "light", brand: "a" }, ":root"),
                block({ mode: "dark", brand: "a" }, '[data-mode="dark"]'),
                block({ mode: "light", brand: "b" }, '[data-brand="b"]'),
            ]);
            expect(written(brand)).toStrictEqual([
                "--surface: #ffffff",
                "--primary: #ff0000",
                "--button: var(--primary)",
            ]);
        });
    });

    it("still skips a value a theme restates that no other block disputes", () => {
        const restating = read({
            "tokens.resolver.json": {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                    },
                ],
            },
            "base.json": { surface: color("#ffffff"), gap: { $type: "dimension", $value: px(8) } },
            "dark.json": { surface: color("#000000"), gap: { $type: "dimension", $value: px(8) } },
        });
        const [, later] = cssBlocks(restating, [rootBlock, darkBlock]);
        expect(written(later)).toStrictEqual(["--surface: #000000"]);
    });
});

describe("cssText", () => {
    const blocks = cssBlocks(tokens, [
        root,
        {
            ...dark,
            selector: ['[data-mode="dark"]', ".dark"],
            atRules: ["@media screen", "@supports (color: red)"],
        },
    ]);

    it("writes each block as a rule, nested in its at-rules", () => {
        expect(cssText(blocks)).toBe(
            [
                ":root {",
                "    --color-ink: #111111;",
                "    --color-paper: #ffffff;",
                "    --color-text: var(--color-ink);",
                "    --color-quote: var(--color-text);",
                "    --gap: 8px;",
                "}",
                "",
                "@media screen {",
                "    @supports (color: red) {",
                '        [data-mode="dark"],',
                "        .dark {",
                "            --color-ink: #eeeeee;",
                "            --color-text: var(--color-ink);",
                "            --color-quote: var(--color-text);",
                "        }",
                "    }",
                "}",
                "",
            ].join("\n"),
        );
    });

    it("leaves out a block that writes nothing, and writes nothing for no blocks", () => {
        const css = cssText(cssBlocks(tokens, [root, { ...root, selector: ".same" }]));
        expect(css).not.toContain(".same");
        expect(cssText(cssBlocks(tokens, []))).toBe("");
    });
});
