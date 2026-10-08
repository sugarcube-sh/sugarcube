import { type Document, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { declare } from "../src/shared/css/declare.js";
import { emitCSS } from "../src/shared/css/emit.js";
import type { InternalConfig } from "../src/types/config.js";
import { readOptions } from "../src/shared/read-options.js";

type Variables = Parameters<typeof fillDefaults>[0]["variables"];

function built(doc: Document, config: InternalConfig) {
    const declared = declare(doc, config);
    const { files, diagnostics } = emitCSS(declared, config);
    return { files, diagnostics: [...declared.diagnostics, ...diagnostics] };
}

function filesFor(files: Record<string, unknown>, variables: Variables = {}) {
    const config = fillDefaults({ variables: { path: "variables.css", ...variables } });
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    const doc = readFromMemory({ files: texts }, readOptions(config));
    return built(doc, config).files;
}

function cssFor(files: Record<string, unknown>, variables: Variables = {}) {
    return filesFor(files, variables)[0]?.css;
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

    it("hands back what reading found from declaring, not from writing", () => {
        const config = fillDefaults({ variables: { path: "variables.css" } });
        const files = { "tokens.json": JSON.stringify({ broken: color("#e11d4") }) };
        const doc = readFromMemory({ files }, readOptions(config));
        const declared = declare(doc, config);
        expect(declared.diagnostics).toStrictEqual(doc.diagnostics);
        expect(emitCSS(declared, config).diagnostics).toStrictEqual([]);
        expect(doc.diagnostics).not.toStrictEqual([]);
    });

    it("declares each permutation once, however many blocks write it", () => {
        const config = fillDefaults({
            variables: {
                path: "variables.css",
                permutations: [
                    {
                        input: { theme: "dark" },
                        selector: ":root",
                        atRule: "@media (prefers-color-scheme: dark)",
                    },
                    { input: { theme: "dark" }, selector: ".dark" },
                ],
            },
        });
        const files = {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "theme",
                        contexts: { light: [], dark: [] },
                        default: "light",
                    },
                ],
            }),
            "tokens.json": JSON.stringify({ ink: color("#111111") }),
        };
        const doc = readFromMemory({ files, entry: "tokens.resolver.json" }, readOptions(config));
        const [first, second] = declare(doc, config).entries;
        expect(first?.declared).toBe(second?.declared);
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
        const declared = declare(doc, config);
        const { files: written } = emitCSS(declared, config);
        const { diagnostics } = declared;

        it("declares and writes nothing, since nothing can go on :root", () => {
            expect(declared.entries).toStrictEqual([]);
            expect(written).toStrictEqual([]);
        });

        it("keeps where the read found it, the modifier in the resolver", () => {
            const [found] = diagnostics;
            expect(found?.at?.file).toBe("tokens.resolver.json");
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

        it("and still says what else the config needs, so one run shows everything", () => {
            const renamed = fillDefaults({
                variables: { path: "variables.css", propagateDependents: true },
            });
            const declaredRenamed = declare(
                readFromMemory({ files, entry: "tokens.resolver.json" }, readOptions(renamed)),
                renamed,
            );
            const emitted = emitCSS(declaredRenamed, renamed);
            expect(emitted.files).toStrictEqual([]);
            expect(declaredRenamed.diagnostics.map(({ kind }) => kind)).toStrictEqual([
                "default-required",
            ]);
            expect(emitted.diagnostics.map(({ kind }) => kind)).toStrictEqual(["option-renamed"]);
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
        expect(built(doc, config).diagnostics.map(({ message }) => message)).toStrictEqual([
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

        it("with only what changed when an earlier selector list holds :root", () => {
            expect(
                cssFor(files, {
                    permutations: [
                        { input: { brand: "house" }, selector: [":root", '[data-brand="house"]'] },
                        { input: { brand: "ocean" }, selector: '[data-brand="ocean"]' },
                    ],
                }),
            ).toBe(
                [
                    ":root,",
                    '[data-brand="house"] {',
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

        it("compared with every earlier block that reaches everywhere it does, later winning", () => {
            expect(
                cssFor(files, {
                    permutations: [
                        { input: { brand: "house" }, selector: ".house" },
                        { input: { brand: "ocean" }, selector: [".a", ".b"] },
                        { input: { brand: "house" }, selector: ".a" },
                    ],
                }),
            ).toBe(
                [
                    ".house {",
                    "    --brand: #e11d48;",
                    "    --text: #111111;",
                    "}",
                    "",
                    ".a,",
                    ".b {",
                    "    --brand: #0ea5e9;",
                    "    --text: #111111;",
                    "}",
                    "",
                    ".a {",
                    "    --brand: #e11d48;",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("inside its at-rule, compared with a block the at-rule does not narrow", () => {
            expect(
                cssFor(files, {
                    permutations: [
                        { input: { brand: "house" }, selector: ":root" },
                        {
                            input: { brand: "ocean" },
                            selector: ":root",
                            atRule: "@media (prefers-color-scheme: dark)",
                        },
                        { input: { brand: "ocean" }, selector: '[data-brand="ocean"]' },
                    ],
                }),
            ).toBe(
                [
                    ":root {",
                    "    --brand: #e11d48;",
                    "    --text: #111111;",
                    "}",
                    "",
                    "@media (prefers-color-scheme: dark) {",
                    "    :root {",
                    "        --brand: #0ea5e9;",
                    "    }",
                    "}",
                    "",
                    '[data-brand="ocean"] {',
                    "    --brand: #0ea5e9;",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("in full when an earlier block has an at-rule the later one does not", () => {
            expect(
                cssFor(files, {
                    permutations: [
                        {
                            input: { brand: "ocean" },
                            selector: ":root",
                            atRule: "@media (min-width: 640px)",
                        },
                        { input: { brand: "house" }, selector: ":root" },
                    ],
                }),
            ).toBe(
                [
                    "@media (min-width: 640px) {",
                    "    :root {",
                    "        --brand: #0ea5e9;",
                    "        --text: #111111;",
                    "    }",
                    "}",
                    "",
                    ":root {",
                    "    --brand: #e11d48;",
                    "    --text: #111111;",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("in its own file for a permutation with a path, whose first block is written in full", () => {
            expect(
                filesFor(files, {
                    permutations: [
                        { input: { brand: "house" }, selector: ":root" },
                        { input: { brand: "ocean" }, selector: ":root", path: "ocean.css" },
                        { input: { brand: "ocean" }, selector: '[data-brand="ocean"]' },
                    ],
                }),
            ).toStrictEqual([
                {
                    path: "variables.css",
                    css: [
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
                },
                {
                    path: "ocean.css",
                    css: [":root {", "    --brand: #0ea5e9;", "    --text: #111111;", "}", ""].join(
                        "\n",
                    ),
                },
            ]);
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

    describe("re-declares, in a later block, every variable referring to something it changes", () => {
        const files = {
            "tokens.resolver.json": {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "theme",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                    },
                ],
            },
            "tokens.json": {
                brand: color("#e11d48"),
                danger: color("{brand}"),
                text: color("#111111"),
                loud: color("{danger}"),
            },
            "dark.json": { brand: color("#0ea5e9") },
        };
        const root = [
            ":root {",
            "    --brand: #e11d48;",
            "    --danger: var(--brand);",
            "    --text: #111111;",
            "    --loud: var(--danger);",
            "}",
            "",
        ];
        const emitted = (variables: Variables) => {
            const config = fillDefaults({ variables: { path: "variables.css", ...variables } });
            const texts = Object.fromEntries(
                Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
            );
            return built(readFromMemory({ files: texts }, readOptions(config)), config);
        };

        it("by default, through chains, after what it changes, in file order", () => {
            expect(cssFor(files)).toBe(
                [
                    ...root,
                    '[data-theme="dark"] {',
                    "    --brand: #0ea5e9;",
                    "    --danger: var(--brand);",
                    "    --loud: var(--danger);",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("not when redeclareDependents is false", () => {
            expect(cssFor(files, { redeclareDependents: false })).toBe(
                [...root, '[data-theme="dark"] {', "    --brand: #0ea5e9;", "}", ""].join("\n"),
            );
        });

        it("adding nothing to a block written in full", () => {
            expect(
                cssFor(files, {
                    permutations: [
                        { input: {}, selector: ".light" },
                        { input: { theme: "dark" }, selector: ".dark" },
                    ],
                }),
            ).toBe(
                [
                    ...root.map((line) => (line === ":root {" ? ".light {" : line)),
                    ".dark {",
                    "    --brand: #0ea5e9;",
                    "    --danger: var(--brand);",
                    "    --text: #111111;",
                    "    --loud: var(--danger);",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("reading the old name, propagateDependents, with a warning naming the new one", () => {
            const renamed =
                "`propagateDependents` is now `redeclareDependents`: rename it in your config; the old name stops working at 1.0";
            const off = emitted({ propagateDependents: false });
            expect(off.files[0]?.css).toContain('[data-theme="dark"] {\n    --brand: #0ea5e9;\n}');
            expect(
                off.diagnostics.map(({ kind, severity, message }) => [kind, severity, message]),
            ).toStrictEqual([["option-renamed", "warning", renamed]]);
            expect(emitted({ propagateDependents: true }).files[0]?.css).toBe(cssFor(files));
            expect(emitted({}).diagnostics).toStrictEqual([]);
        });
    });

    describe("with polyfill, writes each color a browser may lack as its hex, and the color itself where supported", () => {
        const oklch = (components: number[], hex?: string, alpha?: number) =>
            color({
                colorSpace: "oklch",
                components,
                ...(hex && { hex }),
                ...(alpha !== undefined && { alpha }),
            });
        const p3 = (components: number[], hex?: string) =>
            color({ colorSpace: "display-p3", components, ...(hex && { hex }) });
        const polyfill = { transforms: { colorFallbackStrategy: "polyfill" as const } };
        const px = (value: number) => ({ value, unit: "px" });
        const themed = (base: Record<string, unknown>, dark: Record<string, unknown>) => ({
            "tokens.resolver.json": {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "theme",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                    },
                ],
            },
            "tokens.json": base,
            "dark.json": dark,
        });

        it("grouping each color space's query, in the order first met", () => {
            expect(
                cssFor(
                    {
                        "tokens.json": {
                            brand: oklch([0.628, 0.2577, 29.23], "#ff0000"),
                            glow: p3([0.9, 0.2, 0.1], "#e63946"),
                            scrim: oklch([0.7016, 0.3225, 328.363], "#ff00ff", 0.8),
                            plain: color({ colorSpace: "srgb", components: [0.8, 0.4, 0.2] }),
                            soft: color({
                                colorSpace: "hsl",
                                components: [270, 80, 60],
                                hex: "#9933e6",
                            }),
                            ink: color("{brand}"),
                        },
                    },
                    polyfill,
                ),
            ).toBe(
                [
                    ":root {",
                    "    --brand: #ff0000;",
                    "    --glow: #e63946;",
                    "    --scrim: #ff00ffcc;",
                    "    --plain: rgb(204 102 51);",
                    "    --soft: hsl(270 80% 60%);",
                    "    --ink: var(--brand);",
                    "}",
                    "",
                    "@supports (color: oklch(0 0 0)) {",
                    "    :root {",
                    "        --brand: oklch(0.628 0.2577 29.23);",
                    "        --scrim: oklch(0.7016 0.3225 328.363 / 0.8);",
                    "    }",
                    "}",
                    "",
                    "@supports (color: color(display-p3 1 1 1)) {",
                    "    :root {",
                    "        --glow: color(display-p3 0.9 0.2 0.1);",
                    "    }",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("for every space but sRGB and HSL, a composite's condition naming each space it uses", () => {
            expect(
                cssFor(
                    {
                        "tokens.json": {
                            deep: color({
                                colorSpace: "lab",
                                components: [50, 20, -30],
                                hex: "#8a6f9e",
                            }),
                            edge: {
                                $type: "border",
                                $value: {
                                    color: {
                                        colorSpace: "oklch",
                                        components: [0.5, 0.1, 20],
                                        hex: "#aa3344",
                                    },
                                    width: px(1),
                                    style: "solid",
                                },
                            },
                            fade: {
                                $type: "gradient",
                                $value: [
                                    {
                                        color: {
                                            colorSpace: "oklch",
                                            components: [0.5, 0.1, 20],
                                            hex: "#aa3344",
                                        },
                                        position: 0,
                                    },
                                    {
                                        color: {
                                            colorSpace: "display-p3",
                                            components: [0.1, 0.2, 0.3],
                                            hex: "#1a334d",
                                        },
                                        position: 1,
                                    },
                                ],
                            },
                        },
                    },
                    polyfill,
                ),
            ).toBe(
                [
                    ":root {",
                    "    --deep: #8a6f9e;",
                    "    --edge: 1px solid #aa3344;",
                    "    --fade: linear-gradient(#aa3344 0%, #1a334d 100%);",
                    "}",
                    "",
                    "@supports (color: lab(0 0 0)) {",
                    "    :root {",
                    "        --deep: lab(50 20 -30);",
                    "    }",
                    "}",
                    "",
                    "@supports (color: oklch(0 0 0)) {",
                    "    :root {",
                    "        --edge: 1px solid oklch(0.5 0.1 20);",
                    "    }",
                    "}",
                    "",
                    "@supports (color: oklch(0 0 0)) and (color: color(display-p3 1 1 1)) {",
                    "    :root {",
                    "        --fade: linear-gradient(oklch(0.5 0.1 20) 0%, color(display-p3 0.1 0.2 0.3) 100%);",
                    "    }",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("warning, once, that polyfill will be removed", () => {
            const config = fillDefaults({ variables: { path: "variables.css", ...polyfill } });
            const files = { "tokens.json": JSON.stringify({ ink: color("#111111") }) };
            const { diagnostics } = built(readFromMemory({ files }, readOptions(config)), config);
            expect(
                diagnostics.map(({ kind, severity, message }) => [kind, severity, message]),
            ).toStrictEqual([
                [
                    "option-deprecated",
                    "warning",
                    '`colorFallbackStrategy: "polyfill"` is deprecated and will be removed in a later release',
                ],
            ]);
        });

        it("warning about a color with no hex to fall back to, and writing it as it is", () => {
            const config = fillDefaults({ variables: { path: "variables.css", ...polyfill } });
            const files = {
                "tokens.json": JSON.stringify({
                    deep: color({ colorSpace: "lab", components: [50, 20, -30] }),
                }),
            };
            const { files: written, diagnostics } = built(
                readFromMemory({ files }, readOptions(config)),
                config,
            );
            expect(written[0]?.css).toBe(":root {\n    --deep: lab(50 20 -30);\n}\n");
            expect(
                diagnostics
                    .filter(({ kind }) => kind === "fallback-missing")
                    .map(({ kind, severity, path, message }) => [kind, severity, path, message]),
            ).toStrictEqual([
                [
                    "fallback-missing",
                    "warning",
                    "deep",
                    'this `lab` color needs a `hex` to fall back to when `colorFallbackStrategy` is `"polyfill"`: add one, or use `"native"` if every browser you support has `lab`',
                ],
            ]);
        });

        it("in a later block, only where the color or its fallback changed", () => {
            expect(
                cssFor(
                    themed(
                        {
                            same: oklch([0.5, 0.1, 20], "#aa3344"),
                            both: oklch([0.5, 0.1, 20], "#aa3344"),
                            native: oklch([0.5, 0.1, 20], "#aa3344"),
                            fallback: oklch([0.5, 0.1, 20], "#aa3344"),
                        },
                        {
                            both: oklch([0.8, 0.1, 20], "#ee8899"),
                            native: oklch([0.6, 0.1, 20], "#aa3344"),
                            fallback: oklch([0.5, 0.1, 20], "#bb4455"),
                        },
                    ),
                    polyfill,
                ),
            ).toBe(
                [
                    ":root {",
                    "    --same: #aa3344;",
                    "    --both: #aa3344;",
                    "    --native: #aa3344;",
                    "    --fallback: #aa3344;",
                    "}",
                    "",
                    "@supports (color: oklch(0 0 0)) {",
                    "    :root {",
                    "        --same: oklch(0.5 0.1 20);",
                    "        --both: oklch(0.5 0.1 20);",
                    "        --native: oklch(0.5 0.1 20);",
                    "        --fallback: oklch(0.5 0.1 20);",
                    "    }",
                    "}",
                    "",
                    '[data-theme="dark"] {',
                    "    --both: #ee8899;",
                    "    --fallback: #bb4455;",
                    "}",
                    "",
                    "@supports (color: oklch(0 0 0)) {",
                    '    [data-theme="dark"] {',
                    "        --both: oklch(0.8 0.1 20);",
                    "        --native: oklch(0.6 0.1 20);",
                    "        --fallback: oklch(0.5 0.1 20);",
                    "    }",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("in a later block whose color has no fallback, equal to an earlier color's", () => {
            expect(
                cssFor(
                    themed(
                        { brand: oklch([0.628, 0.2577, 29.23], "#ff0000") },
                        { brand: color("#ff0000") },
                    ),
                    polyfill,
                ),
            ).toBe(
                [
                    ":root {",
                    "    --brand: #ff0000;",
                    "}",
                    "",
                    "@supports (color: oklch(0 0 0)) {",
                    "    :root {",
                    "        --brand: oklch(0.628 0.2577 29.23);",
                    "    }",
                    "}",
                    "",
                    '[data-theme="dark"] {',
                    "    --brand: #ff0000;",
                    "}",
                    "",
                ].join("\n"),
            );
        });

        it("inside a block's at-rule, and from a private token's own fallback and color", () => {
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
            expect(
                cssFor(
                    {
                        "tokens.resolver.json": resolver,
                        "palette.json": { rose: oklch([0.6, 0.2, 10], "#e11d48") },
                        "system.json": {
                            brand: color("{rose}"),
                            edge: {
                                $type: "border",
                                $value: { color: "{rose}", width: px(1), style: "solid" },
                            },
                        },
                    },
                    {
                        ...polyfill,
                        permutations: [{ input: {}, selector: ":root", atRule: "@media screen" }],
                    },
                ),
            ).toBe(
                [
                    "@media screen {",
                    "    :root {",
                    "        --brand: #e11d48;",
                    "        --edge: 1px solid #e11d48;",
                    "    }",
                    "",
                    "    @supports (color: oklch(0 0 0)) {",
                    "        :root {",
                    "            --brand: oklch(0.6 0.2 10);",
                    "            --edge: 1px solid oklch(0.6 0.2 10);",
                    "        }",
                    "    }",
                    "}",
                    "",
                ].join("\n"),
            );
        });
    });

    describe("reports as an error two tokens that make the same variable name", () => {
        const clash = (first: string, later: string, name: string) =>
            `\`${first}\` and \`${later}\` both make \`${name}\`, so only \`${later}\`'s value is used: rename one`;
        const problems = (files: Record<string, unknown>, variables: Variables = {}) => {
            const config = fillDefaults({ variables: { path: "variables.css", ...variables } });
            const texts = Object.fromEntries(
                Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
            );
            return built(
                readFromMemory({ files: texts }, readOptions(config)),
                config,
            ).diagnostics.map(({ kind, severity, path, message }) => [
                kind,
                severity,
                path,
                message,
            ]);
        };
        const px = (value: number) => ({ $type: "dimension", $value: { value, unit: "px" } });

        it("on the later one, naming both", () => {
            expect(
                problems({ "tokens.json": { "a": { "b-c": px(1) }, "a-b": { c: px(2) } } }),
            ).toStrictEqual([
                ["same-variable-name", "error", "a-b.c", clash("a.b-c", "a-b.c", "--a-b-c")],
            ]);
        });

        it("including a typography token's variables, and names a naming function makes alike", () => {
            const heading = {
                $type: "typography",
                $value: {
                    fontFamily: "Inter",
                    fontSize: { value: 2, unit: "rem" },
                    fontWeight: 700,
                    letterSpacing: { value: 0, unit: "px" },
                    lineHeight: 1.2,
                },
            };
            expect(
                problems({ "tokens.json": { heading, "heading-font-size": px(32) } }),
            ).toStrictEqual([
                [
                    "same-variable-name",
                    "error",
                    "heading-font-size",
                    clash("heading", "heading-font-size", "--heading-font-size"),
                ],
            ]);
            expect(
                problems(
                    { "tokens.json": { Brand: px(1), brand: px(2) } },
                    { variableName: (path: string) => path.toLowerCase() },
                ),
            ).toStrictEqual([
                ["same-variable-name", "error", "brand", clash("Brand", "brand", "--brand")],
            ]);
        });

        it("once, however many permutations hold the pair", () => {
            const resolver = {
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "theme",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                    },
                ],
            };
            expect(
                problems({
                    "tokens.resolver.json": resolver,
                    "tokens.json": { "a": { "b-c": px(1) }, "a-b": { c: px(2) } },
                    "dark.json": { "a-b": { c: px(3) } },
                }),
            ).toHaveLength(1);
        });
    });

    it("stacks a media query on an earlier one that matches wherever it does", () => {
        const resolver = {
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                {
                    type: "modifier",
                    name: "screen",
                    default: "narrow",
                    contexts: {
                        narrow: [],
                        medium: [{ $ref: "medium.json" }],
                        wide: [{ $ref: "wide.json" }],
                    },
                },
            ],
        };
        const size = (value: number) => ({ $type: "dimension", $value: { value, unit: "px" } });
        expect(
            cssFor(
                {
                    "tokens.resolver.json": resolver,
                    "tokens.json": { gap: size(4), text: size(14) },
                    "medium.json": { gap: size(8), text: size(16) },
                    "wide.json": { gap: size(8), text: size(18) },
                },
                {
                    permutations: [
                        { input: {}, selector: ":root" },
                        {
                            input: { screen: "medium" },
                            selector: ":root",
                            atRule: "@media (min-width: 640px)",
                        },
                        {
                            input: { screen: "wide" },
                            selector: ":root",
                            atRule: "@media (min-width: 1024px)",
                        },
                    ],
                },
            ),
        ).toBe(
            [
                ":root {",
                "    --gap: 4px;",
                "    --text: 14px;",
                "}",
                "",
                "@media (min-width: 640px) {",
                "    :root {",
                "        --gap: 8px;",
                "        --text: 16px;",
                "    }",
                "}",
                "",
                "@media (min-width: 1024px) {",
                "    :root {",
                "        --text: 18px;",
                "    }",
                "}",
                "",
            ].join("\n"),
        );
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

        it("setting aside a property its type does not define, such as a design tool's paragraphSpacing, with a warning", () => {
            const config = fillDefaults({ variables: { path: "variables.css" } });
            const tokens = {
                heading: {
                    $type: "typography",
                    $value: {
                        fontFamily: "Inter",
                        fontSize: { value: 2, unit: "rem" },
                        fontWeight: 700,
                        letterSpacing: px(0),
                        lineHeight: 1.2,
                        paragraphSpacing: px(16),
                    },
                },
            };
            const files = { "tokens.json": JSON.stringify(tokens) };
            const { files: written, diagnostics } = built(
                readFromMemory({ files }, readOptions(config)),
                config,
            );
            expect(written[0]?.css).toContain("--heading-line-height: 1.2;");
            expect(
                diagnostics.map(({ kind, severity, message }) => [kind, severity, message]),
            ).toStrictEqual([
                [
                    "unknown-property",
                    "warning",
                    "`paragraphSpacing` is not a property of a typography value, so it is ignored",
                ],
            ]);
        });

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
            return built(readFromMemory({ files }, readOptions(config)), config);
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
                const { diagnostics } = built(
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

        it("setting aside a property its min or max does not define, with a warning", () => {
            const { files, diagnostics } = read({
                step: fluid({ min: { ...px(16), clamp: true }, max: px(20) }),
            });
            expect(files[0]?.css).toBe(
                ":root {\n    --step: clamp(1rem, 0.9091rem + 0.4545vw, 1.25rem);\n}\n",
            );
            expect(
                diagnostics.map(({ kind, path, message }) => [kind, path, message]),
            ).toStrictEqual([
                [
                    "unknown-property",
                    "step",
                    "`clamp` is not a property of a dimension, so it is ignored",
                ],
            ]);
        });

        it("reading a fluid range as the Document's values were read", () => {
            const config = fillDefaults({
                variables: {
                    path: "variables.css",
                    transforms: { fluid: { min: 320, max: 1200 } },
                },
            });
            const files = {
                "tokens.json": JSON.stringify({
                    step: fluid({ min: { ...px(16), clamp: true }, max: px(20) }),
                }),
            };
            const strict = { ...readOptions(config), ignoreUnknownProperties: false };
            const { files: written } = built(readFromMemory({ files }, strict), config);
            expect(written[0]?.css ?? "").not.toContain("clamp(");
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
