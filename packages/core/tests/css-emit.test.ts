import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { emitCSS } from "../src/shared/css/emit.js";
import { readOptions } from "../src/shared/read-options.js";

type Variables = Parameters<typeof fillDefaults>[0]["variables"];

function cssFor(files: Record<string, unknown>, variables: Variables = {}) {
    const config = fillDefaults({ variables: { path: "variables.css", ...variables } });
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    const doc = readFromMemory({ files: texts }, readOptions(config));
    return emitCSS(doc, config).files[0]?.css;
}

const color = (value: unknown) => ({ $type: "color", $value: value });

describe("emitCSS", () => {
    it("writes an sRGB color with a hex as that hex, eight digits when it has alpha", () => {
        expect(
            cssFor({
                "tokens.json": {
                    plain: color("#e11d48"),
                    scrim: color("#00000080"),
                    loud: color("#0000FFCC"),
                    object: color({ colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" }),
                    bare: color({ colorSpace: "srgb", components: [1, 0, 0] }),
                },
            }),
        ).toBe(
            [
                ":root {",
                "    --plain: #e11d48;",
                "    --scrim: #00000080;",
                "    --loud: #0000FFCC;",
                "    --object: #ff0000;",
                "    --bare: rgb(255 0 0);",
                "}",
                "",
            ].join("\n"),
        );
    });

    it("writes var() for an alias to a token with a variable, and the value for one without", () => {
        const resolver = {
            version: "2025.10",
            resolutionOrder: [
                {
                    type: "set",
                    name: "palette",
                    sources: [{ $ref: "palette.json" }],
                    $extensions: { "sh.sugarcube": { emit: false } },
                },
                { type: "set", name: "semantic", sources: [{ $ref: "semantic.json" }] },
            ],
        };
        expect(
            cssFor({
                "tokens.resolver.json": resolver,
                "palette.json": { rose: color("#e11d48") },
                "semantic.json": {
                    brand: color("{rose}"),
                    danger: color("{brand}"),
                    space: { $type: "dimension", $value: { value: 4, unit: "px" } },
                },
            }),
        ).toBe(
            [
                ":root {",
                "    --brand: #e11d48;",
                "    --danger: var(--brand);",
                "    --space: 4px;",
                "}",
                "",
            ].join("\n"),
        );
    });

    it("hands back what reading found", () => {
        const config = fillDefaults({ variables: { path: "variables.css" } });
        const files = { "tokens.json": JSON.stringify({ broken: color("#e11d4") }) };
        const doc = readFromMemory({ files }, readOptions(config));
        expect(emitCSS(doc, config).diagnostics).toStrictEqual(doc.diagnostics);
        expect(doc.diagnostics).not.toStrictEqual([]);
    });

    describe("with a modifier that has no default and no permutations in the config", () => {
        const config = fillDefaults({ variables: { path: "variables.css" } });
        const files = {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "brand",
                        contexts: { house: [], ocean: [{ $ref: "ocean.json" }] },
                    },
                    {
                        type: "modifier",
                        name: "theme",
                        contexts: { light: [], dark: [] },
                        default: "light",
                    },
                ],
            }),
            "tokens.json": JSON.stringify({ brand: color("#e11d48") }),
            "ocean.json": JSON.stringify({ brand: color("#0ea5e9") }),
        };
        const doc = readFromMemory({ files, entry: "tokens.resolver.json" }, readOptions(config));
        const { files: written, diagnostics } = emitCSS(doc, config);

        it("writes nothing, since nothing can go on :root", () => {
            expect(written).toStrictEqual([]);
        });

        it("says which modifier needs a default, in place of the read's warning", () => {
            expect(diagnostics.map(({ kind }) => kind)).toStrictEqual(["default-required"]);
            expect(diagnostics[0]).toMatchObject({
                severity: "error",
                detail: { modifiers: ["brand"] },
                docs: "https://sugarcube.sh/errors/default-required",
                message:
                    "the modifier `brand` has no default, so there is nothing to write on `:root`: give it a `default` in the resolver, or list the permutations to write in `variables.permutations`",
            });
        });
    });

    it("names every modifier that has no default", () => {
        const config = fillDefaults({ variables: { path: "variables.css" } });
        const modifier = (name: string) => ({ type: "modifier", name, contexts: { a: [], b: [] } });
        const files = {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    modifier("brand"),
                    modifier("size"),
                ],
            }),
            "tokens.json": JSON.stringify({ brand: color("#e11d48") }),
        };
        const doc = readFromMemory({ files, entry: "tokens.resolver.json" }, readOptions(config));
        expect(emitCSS(doc, config).diagnostics.map(({ message }) => message)).toStrictEqual([
            "the modifiers `brand` and `size` have no default, so there is nothing to write on `:root`: give them a `default` in the resolver, or list the permutations to write in `variables.permutations`",
        ]);
    });

    describe("writes a later permutation's block", () => {
        const files = {
            "tokens.resolver.json": {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "brand",
                        contexts: { house: [], ocean: [{ $ref: "ocean.json" }] },
                        default: "house",
                    },
                ],
            },
            "tokens.json": { brand: color("#e11d48"), text: color("#111111") },
            "ocean.json": { brand: color("#0ea5e9") },
        };
        const brands = (first: string) => [
            { input: { brand: "house" }, selector: first },
            { input: { brand: "ocean" }, selector: '[data-brand="ocean"]' },
        ];

        it("with only what changed when the first block reaches every element", () => {
            expect(cssFor(files, { permutations: brands(":root") })).toBe(
                [
                    ":root {",
                    "    --brand: #e11d48;",
                    "    --text: #111111;",
                    "}",
                    "",
                    '[data-brand="ocean"] {',
                    "    --brand: #0ea5e9;",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("in full when the first block may not apply where it does", () => {
            expect(cssFor(files, { permutations: brands('[data-brand="house"]') })).toBe(
                [
                    '[data-brand="house"] {',
                    "    --brand: #e11d48;",
                    "    --text: #111111;",
                    "}",
                    "",
                    '[data-brand="ocean"] {',
                    "    --brand: #0ea5e9;",
                    "    --text: #111111;",
                    "}",
                    "",
                ].join("\n"),
            );
        });
    });

    it("leaves out a token whose value cannot be read, and writes the rest", () => {
        expect(cssFor({ "tokens.json": { broken: color("#e11d4"), fine: color("#e11d48") } })).toBe(
            ":root {\n    --fine: #e11d48;\n}\n",
        );
    });

    describe("names each variable from its path", () => {
        const tokens = {
            "tokens.json": {
                color: {
                    "$type": "color",
                    "accent": { $root: { $value: "#e11d48" }, soft: { $value: "#fda4af" } },
                    "on surface": { $value: "{color.accent.$root}" },
                },
            },
        };

        it("with $root standing for its group, and spaces as hyphens", () => {
            expect(cssFor(tokens)).toBe(
                [
                    ":root {",
                    "    --color-accent: #e11d48;",
                    "    --color-accent-soft: #fda4af;",
                    "    --color-on-surface: var(--color-accent);",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("with the config's prefix first, in declarations and references alike", () => {
            expect(cssFor(tokens, { prefix: "ds" })).toContain(
                "--ds-color-on-surface: var(--ds-color-accent);",
            );
        });

        it("with the config's variableName instead, given the path without $root", () => {
            const variableName = (path: string) => path.replaceAll(".", "_");
            expect(cssFor(tokens, { variableName })).toContain(
                "--color_on surface: var(--color_accent);",
            );
        });
    });

    describe("writes composites part by part", () => {
        const px = (value: number) => ({ value, unit: "px" });
        const palette = {
            version: "2025.10",
            resolutionOrder: [
                {
                    type: "set",
                    name: "palette",
                    sources: [{ $ref: "palette.json" }],
                    $extensions: { "sh.sugarcube": { emit: false } },
                },
                { type: "set", name: "system", sources: [{ $ref: "system.json" }] },
            ],
        };
        const declarations = (system: Record<string, unknown>) =>
            cssFor({
                "tokens.resolver.json": palette,
                "palette.json": {
                    rose: color("#e11d48"),
                    hairline: { $type: "dimension", $value: px(1) },
                },
                "system.json": system,
            })
                ?.split("\n")
                .filter((line) => line.startsWith("    "))
                .map((line) => line.trim());

        it("with var() for a part referring to a token with a variable, and the value otherwise", () => {
            expect(
                declarations({
                    ink: color("#111111"),
                    edge: {
                        $type: "border",
                        $value: { color: "{ink}", width: "{hairline}", style: "solid" },
                    },
                    lift: {
                        $type: "shadow",
                        $value: {
                            color: "{rose}",
                            offsetX: px(0),
                            offsetY: px(1),
                            blur: px(2),
                            spread: px(0),
                        },
                    },
                }),
            ).toStrictEqual([
                "--ink: #111111;",
                "--edge: 1px solid var(--ink);",
                "--lift: 0px 1px 2px 0px #e11d48;",
            ]);
        });

        it("with the value for a part written as a JSON Pointer", () => {
            expect(
                declarations({
                    deep: color({ colorSpace: "srgb", components: [0.2, 0, 0] }),
                    edge: {
                        $type: "border",
                        $value: { color: { $ref: "#/deep/$value" }, width: px(2), style: "dashed" },
                    },
                    tint: color({
                        colorSpace: "srgb",
                        components: [{ $ref: "#/deep/$value/components/0" }, 1, 1],
                    }),
                }),
            ).toStrictEqual([
                "--deep: rgb(51 0 0);",
                "--edge: 2px dashed rgb(51 0 0);",
                "--tint: rgb(51 255 255);",
            ]);
        });

        it("with var() for a shadow layer referring to a whole shadow token", () => {
            expect(
                declarations({
                    lift: {
                        $type: "shadow",
                        $value: {
                            color: "#000000",
                            offsetX: px(0),
                            offsetY: px(1),
                            blur: px(2),
                            spread: px(0),
                        },
                    },
                    stack: {
                        $type: "shadow",
                        $value: [
                            "{lift}",
                            {
                                color: "#000000",
                                offsetX: px(0),
                                offsetY: px(4),
                                blur: px(8),
                                spread: px(0),
                                inset: true,
                            },
                        ],
                    },
                }),
            ).toStrictEqual([
                "--lift: 0px 1px 2px 0px #000000;",
                "--stack: var(--lift), inset 0px 4px 8px 0px #000000;",
            ]);
        });

        it("with a gradient's stops written out where a stop refers to another gradient", () => {
            expect(
                declarations({
                    half: { $type: "number", $value: 0.5 },
                    start: { $type: "gradient", $value: [{ color: "#ffffff", position: 0 }] },
                    fade: {
                        $type: "gradient",
                        $value: ["{start}", { color: "{rose}", position: "{half}" }],
                    },
                }),
            ).toStrictEqual([
                "--half: 0.5;",
                "--start: linear-gradient(#ffffff 0%);",
                "--fade: linear-gradient(#ffffff 0%, #e11d48 clamp(0%, var(--half) * 100%, 100%));",
            ]);
        });

        it("with typography as one variable per part, each part of a referred-to style its own var()", () => {
            const body = {
                $type: "typography",
                $value: {
                    fontFamily: ["Inter", "sans-serif"],
                    fontSize: "{hairline}",
                    fontWeight: 400,
                    letterSpacing: px(0),
                    lineHeight: 0,
                },
            };
            expect(
                declarations({ body, quote: { $type: "typography", $value: "{body}" } }),
            ).toStrictEqual([
                "--body-font-family: Inter, sans-serif;",
                "--body-font-size: 1px;",
                "--body-font-weight: 400;",
                "--body-letter-spacing: 0px;",
                "--body-line-height: 0;",
                "--quote-font-family: var(--body-font-family);",
                "--quote-font-size: var(--body-font-size);",
                "--quote-font-weight: var(--body-font-weight);",
                "--quote-letter-spacing: var(--body-letter-spacing);",
                "--quote-line-height: var(--body-line-height);",
            ]);
        });
    });
});
