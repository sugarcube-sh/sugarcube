import { type DesignTokens, readFromMemory } from "@sugarcube-sh/dtcg";
import { createCSSWriter } from "@sugarcube-sh/dtcg/css";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { createCSSWriterOptions } from "../src/shared/css/writer-options.js";
import { createReadOptions } from "../src/shared/read-options.js";

const rem = (value: number) => ({ value, unit: "rem" });
const oklch = (l: number, c: number, h: number, hex: string) => ({
    $value: { colorSpace: "oklch", components: [l, c, h], hex },
});

const config = fillDefaults({ variables: { path: "variables.css" } });

function demo(): DesignTokens {
    const files = {
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
        "base.json": {
            color: {
                $type: "color",
                neutral: {
                    50: oklch(0.986, 0.002, 258, "#fafafc"),
                    900: oklch(0.245, 0.013, 258, "#1c1d24"),
                },
                text: { default: { $value: "{color.neutral.900}" } },
            },
            size: {
                fluid: {
                    gutter: {
                        $type: "dimension",
                        $value: rem(2),
                        $extensions: { "sh.sugarcube": { fluid: { min: rem(1), max: rem(2) } } },
                    },
                },
            },
        },
        "dark.json": { color: { text: { default: { $value: "{color.neutral.50}" } } } },
    };
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    return readFromMemory({ files: texts }, createReadOptions(config));
}

describe("createCSSWriterOptions", () => {
    const tokens = demo();
    const light = tokens.getPermutation();
    const dark = tokens.getPermutation({ mode: "dark" });

    it("writes each token as the build does, fluid as clamp() and references as var()", () => {
        const writer = createCSSWriter(createCSSWriterOptions(tokens, config));
        const named = (permutation: typeof light) =>
            writer
                .getDeclarations(permutation)
                .declarations.map(({ name, value }) => `${name}: ${value}`);
        expect(named(light)).toStrictEqual([
            "--color-neutral-50: oklch(0.986 0.002 258)",
            "--color-neutral-900: oklch(0.245 0.013 258)",
            "--color-text-default: var(--color-neutral-900)",
            "--size-fluid-gutter: clamp(1rem, 0.6364rem + 1.8182vw, 2rem)",
        ]);
        expect(named(dark)).toContain("--color-text-default: var(--color-neutral-50)");
    });

    it("answers one token with references as values, for a screen showing what the build writes", () => {
        const writer = createCSSWriter({
            ...createCSSWriterOptions(tokens, config),
            references: "values",
        });
        expect(writer.getValue(light.getToken("size.fluid.gutter")!)?.css).toBe(
            "clamp(1rem, 0.6364rem + 1.8182vw, 2rem)",
        );
        expect(writer.getValue(dark.getToken("color.text.default")!)?.css).toBe(
            "oklch(0.986 0.002 258)",
        );
    });

    it("names variables from the config's naming settings", () => {
        const named = fillDefaults({
            variables: { path: "variables.css", prefix: "ds", case: "kebab", delimiter: "_" },
        });
        const writer = createCSSWriter(createCSSWriterOptions(tokens, named));
        expect(writer.getDeclarations(light).declarations.map(({ name }) => name)).toContain(
            "--ds_color_text_default",
        );
    });
});
