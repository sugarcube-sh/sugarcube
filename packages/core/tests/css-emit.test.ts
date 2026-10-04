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

        it("with the config's variableName instead, given the path without $root, escaped", () => {
            const variableName = (path: string) => path.replaceAll(".", "_");
            expect(cssFor(tokens, { variableName })).toContain(
                "--color_on\\ surface: var(--color_accent);",
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

    describe("writes a fluid dimension as a clamp between the config's viewport widths", () => {
        const fluid = (value: unknown) => ({
            $type: "dimension",
            $value: { value: 1, unit: "rem" },
            $extensions: { "sh.sugarcube": { fluid: value } },
        });
        const px = (value: number) => ({ value, unit: "px" });
        const read = (tokens: Record<string, unknown>) => {
            const config = fillDefaults({
                variables: {
                    path: "variables.css",
                    transforms: { fluid: { min: 320, max: 1200 } },
                },
            });
            const files = { "tokens.json": JSON.stringify(tokens) };
            return emitCSS(readFromMemory({ files }, readOptions(config)), config);
        };

        it("from its min and max, as Utopia works it out, the token's own value unused", () => {
            const { files } = read({
                step: fluid({ min: px(16), max: { value: 1.25, unit: "rem" } }),
                shrink: fluid({ min: px(20), max: px(16) }),
                flat: fluid({ min: px(16), max: px(16) }),
                gap: { $type: "dimension", $value: "{step}" },
            });
            expect(files[0]?.css).toBe(
                [
                    ":root {",
                    "    --step: clamp(1rem, 0.9091rem + 0.4545vw, 1.25rem);",
                    "    --shrink: clamp(1rem, 1.3409rem + -0.4545vw, 1.25rem);",
                    "    --flat: 1rem;",
                    "    --gap: var(--step);",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("wherever a token refers to a private one, which writes no variable of its own", () => {
            const resolver = {
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
            const clamp = "clamp(1rem, 0.9091rem + 0.4545vw, 1.25rem)";
            expect(
                cssFor(
                    {
                        "tokens.resolver.json": resolver,
                        "palette.json": {
                            step: fluid({ min: px(16), max: { value: 1.25, unit: "rem" } }),
                            alias: { $type: "dimension", $value: "{step}" },
                            type: {
                                $type: "typography",
                                $value: {
                                    fontFamily: "Inter",
                                    fontSize: "{step}",
                                    fontWeight: 700,
                                    letterSpacing: px(0),
                                    lineHeight: 1.2,
                                },
                            },
                        },
                        "system.json": {
                            gap: { $type: "dimension", $value: "{step}" },
                            through: { $type: "dimension", $value: "{alias}" },
                            edge: {
                                $type: "border",
                                $value: { color: "#000000", width: "{step}", style: "solid" },
                            },
                            body: {
                                $type: "typography",
                                $value: {
                                    fontFamily: "Inter",
                                    fontSize: "{step}",
                                    fontWeight: 400,
                                    letterSpacing: px(0),
                                    lineHeight: 1.5,
                                },
                            },
                            heading: { $type: "typography", $value: "{type}" },
                        },
                    },
                    { transforms: { fluid: { min: 320, max: 1200 } } },
                ),
            ).toBe(
                [
                    ":root {",
                    `    --gap: ${clamp};`,
                    `    --through: ${clamp};`,
                    `    --edge: ${clamp} solid #000000;`,
                    "    --body-font-family: Inter;",
                    `    --body-font-size: ${clamp};`,
                    "    --body-font-weight: 400;",
                    "    --body-letter-spacing: 0px;",
                    "    --body-line-height: 1.5;",
                    "    --heading-font-family: Inter;",
                    `    --heading-font-size: ${clamp};`,
                    "    --heading-font-weight: 700;",
                    "    --heading-letter-spacing: 0px;",
                    "    --heading-line-height: 1.2;",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("from its own range even when its value is a reference, as a fluid token never uses its value", () => {
            const { files } = read({
                step: fluid({ min: px(16), max: { value: 1.25, unit: "rem" } }),
                own: { ...fluid({ min: px(20), max: px(24) }), $value: "{step}" },
            });
            expect(files[0]?.css).toBe(
                [
                    ":root {",
                    "    --step: clamp(1rem, 0.9091rem + 0.4545vw, 1.25rem);",
                    "    --own: clamp(1.25rem, 1.1591rem + 0.4545vw, 1.5rem);",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        describe("and warns when fluid text cannot be zoomed to 200% (WCAG 1.4.4)", () => {
            const text = (fontSize: string) => ({
                $type: "typography",
                $value: {
                    fontFamily: "Inter",
                    fontSize,
                    fontWeight: 400,
                    letterSpacing: px(0),
                    lineHeight: 1.5,
                },
            });
            const zoom = (from: number, to: number) =>
                `this fluid size grows too fast to zoom to 200% on screens ${from}px to ${to}px wide (WCAG 1.4.4): bring \`min\` and \`max\` closer together`;
            const warnings = (diagnostics: { kind: string; path?: string; message: string }[]) =>
                diagnostics.map(({ kind, path, message }) => [kind, path, message]);

            it("on the fluid size a typography token uses, followed through references", () => {
                const { diagnostics } = read({
                    huge: fluid({ min: px(16), max: px(64) }),
                    calm: fluid({ min: px(16), max: px(20) }),
                    gap: fluid({ min: px(16), max: px(64) }),
                    big: fluid({ min: px(24), max: px(72) }),
                    heading: { $type: "dimension", $value: "{big}" },
                    body: text("{huge}"),
                    label: text("{calm}"),
                    title: text("{heading}"),
                });
                expect(warnings(diagnostics)).toStrictEqual([
                    ["fluid-text-zoom", "huge", zoom(760, 2480)],
                    ["fluid-text-zoom", "big", zoom(980, 2040)],
                ]);
                expect(diagnostics.every(({ severity }) => severity === "warning")).toBe(true);
            });

            it("once, however many permutations hold it", () => {
                const config = fillDefaults({
                    variables: {
                        path: "variables.css",
                        transforms: { fluid: { min: 320, max: 1200 } },
                    },
                });
                const resolver = {
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
                };
                const files = Object.fromEntries(
                    Object.entries({
                        "tokens.resolver.json": resolver,
                        "base.json": {
                            huge: fluid({ min: px(16), max: px(64) }),
                            body: text("{huge}"),
                        },
                        "dark.json": { ink: color("#eeeeee") },
                    }).map(([path, json]) => [path, JSON.stringify(json)]),
                );
                const { diagnostics } = emitCSS(
                    readFromMemory({ files }, readOptions(config)),
                    config,
                );
                expect(warnings(diagnostics)).toStrictEqual([
                    ["fluid-text-zoom", "huge", zoom(760, 2480)],
                ]);
            });
        });

        it("for a recipe's steps", () => {
            const { files } = read({
                space: {
                    $type: "dimension",
                    $extensions: {
                        "sh.sugarcube": {
                            scale: {
                                mode: "multipliers",
                                base: { min: px(16), max: px(20) },
                                multipliers: { sm: 0.5, md: 1 },
                            },
                        },
                    },
                },
            });
            expect(files[0]?.css).toContain(
                "--space-md: clamp(1rem, 0.9091rem + 0.4545vw, 1.25rem);",
            );
        });

        it("only for a dimension, ignoring a fluid range on any other type", () => {
            const { files, diagnostics } = read({
                tint: {
                    $type: "color",
                    $value: "#e11d48",
                    $extensions: { "sh.sugarcube": { fluid: "big" } },
                },
            });
            expect(files[0]?.css).toBe(":root {\n    --tint: #e11d48;\n}\n");
            expect(diagnostics).toStrictEqual([]);
        });

        it("and reports a fluid range it cannot read, leaving that token out", () => {
            const { files, diagnostics } = read({
                word: fluid("big"),
                off: fluid(false),
                half: fluid({ min: px(16) }),
                text: fluid({ min: "16px", max: px(20) }),
                fine: { $type: "dimension", $value: px(4) },
            });
            expect(files[0]?.css).toBe(":root {\n    --fine: 4px;\n}\n");
            expect(
                diagnostics.map(({ kind, path, message }) => [kind, path, message]),
            ).toStrictEqual([
                ["extension-invalid", "word", "`fluid` must be an object"],
                ["extension-invalid", "off", "`fluid` must be an object"],
                ["extension-invalid", "half", "the fluid range needs `max`"],
                ["invalid-value", "text", expect.stringContaining("16px")],
            ]);
        });
    });
});
