import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { readOptions } from "../src/shared/read-options.js";
import { utilityTokens } from "../src/shared/utilities/tokens.js";

type Variables = Parameters<typeof fillDefaults>[0]["variables"];

function tokensFor(files: Record<string, unknown>, variables: Variables = {}) {
    const config = fillDefaults({ variables: { path: "variables.css", ...variables } });
    const texts = Object.fromEntries(
        Object.entries(files).map(([path, json]) => [path, JSON.stringify(json)]),
    );
    return utilityTokens(readFromMemory({ files: texts }, readOptions(config)), config).map(
        (listed) => {
            const { path, type } = listed.token;
            if ("name" in listed) return { path, type, name: listed.name };
            if ("variables" in listed) return { path, type, variables: listed.variables };
            return { path, type, private: listed.private };
        },
    );
}

const color = (value: unknown) => ({ $type: "color", $value: value });
const dimension = (value: number) => ({ $type: "dimension", $value: { value, unit: "px" } });

const themed = {
    "tokens.resolver.json": {
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
            {
                type: "modifier",
                name: "theme",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
        ],
    },
    "base.json": { ink: color("#111111"), space: { "1/2": dimension(2) } },
    "dark.json": { ink: color("#eeeeee"), glow: color("#ffffff") },
};

describe("utilityTokens", () => {
    it("lists each token with a variable in any permutation, once, in the order first met, by its variable's name", () => {
        expect(tokensFor(themed, { prefix: "ds" })).toStrictEqual([
            { path: "ink", type: "color", name: "--ds-ink" },
            { path: "space.1/2", type: "dimension", name: "--ds-space-1\\/2" },
            { path: "glow", type: "color", name: "--ds-glow" },
        ]);
    });

    it("reads only the permutations the config lists", () => {
        const light = { input: { theme: "light" }, selector: ":root" };
        const dark = { input: { theme: "dark" }, selector: ".dark" };
        const paths = (permutations: (typeof light)[]) =>
            tokensFor(themed, { permutations }).map(({ path }) => path);
        expect(paths([light])).toStrictEqual(["ink", "space.1/2"]);
        expect(paths([light, dark, light])).toStrictEqual(["ink", "space.1/2", "glow"]);
    });

    it("names each token as variableName does", () => {
        const variableName = (path: string) => path.replaceAll(".", "_");
        expect(tokensFor(themed, { variableName })[1]).toStrictEqual({
            path: "space.1/2",
            type: "dimension",
            name: "--space_1\\/2",
        });
    });

    it("lists a token with no variable after every declared one, saying whether it is private", () => {
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
        const found = tokensFor({
            "tokens.resolver.json": resolver,
            "palette.json": { rose: color("#e11d48") },
            "semantic.json": { broken: color("not a color"), brand: color("{rose}") },
        });
        expect(found).toStrictEqual([
            { path: "brand", type: "color", name: "--brand" },
            { path: "rose", type: "color", private: true },
            { path: "broken", type: "color", private: false },
        ]);
    });

    it("lists a token private in one permutation and declared in another as declared", () => {
        const resolver = {
            version: "2025.10",
            resolutionOrder: [
                {
                    type: "set",
                    name: "palette",
                    sources: [{ $ref: "palette.json" }],
                    $extensions: { "sh.sugarcube": { emit: false } },
                },
                {
                    type: "modifier",
                    name: "theme",
                    default: "light",
                    contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                },
            ],
        };
        const found = tokensFor({
            "tokens.resolver.json": resolver,
            "palette.json": { rose: color("#e11d48") },
            "dark.json": { rose: color("#fb7185") },
        });
        expect(found).toStrictEqual([{ path: "rose", type: "color", name: "--rose" }]);
    });

    it("lists a color once under polyfill, though it is declared twice", () => {
        const oklch = color({ colorSpace: "oklch", components: [0.6, 0.2, 20], hex: "#e11d48" });
        const found = tokensFor(
            { "tokens.json": { brand: oklch } },
            {
                transforms: { colorFallbackStrategy: "polyfill" },
            },
        );
        expect(found).toStrictEqual([{ path: "brand", type: "color", name: "--brand" }]);
    });

    it("lists typography with each CSS property's variable", () => {
        const body = {
            $type: "typography",
            $value: {
                fontFamily: "Inter",
                fontSize: { value: 16, unit: "px" },
                fontWeight: 400,
                letterSpacing: { value: 0, unit: "px" },
                lineHeight: 1.5,
            },
        };
        expect(tokensFor({ "tokens.json": { type: { body } } })).toStrictEqual([
            {
                path: "type.body",
                type: "typography",
                variables: [
                    { property: "font-family", name: "--type-body-font-family" },
                    { property: "font-size", name: "--type-body-font-size" },
                    { property: "font-weight", name: "--type-body-font-weight" },
                    { property: "letter-spacing", name: "--type-body-letter-spacing" },
                    { property: "line-height", name: "--type-body-line-height" },
                ],
            },
        ]);
    });
});
