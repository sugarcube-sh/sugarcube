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
    return emitCSS(doc, config)[0]?.css;
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
});
