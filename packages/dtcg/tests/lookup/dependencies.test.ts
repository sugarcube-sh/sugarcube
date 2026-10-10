import { describe, expect, it } from "vitest";
import { type Token, dependencies, readFromMemory } from "../../src/index.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const red = { colorSpace: "srgb", components: [1, 0, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };
const paths = (tokens: Token[]) => tokens.map(({ path }) => path);

const resolver = {
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
};

const doc = readFromMemory({
    files: {
        "tokens.resolver.json": JSON.stringify(resolver),
        "base.json": JSON.stringify({
            red: color(red),
            blue: color(blue),
            brand: color("{red}"),
            danger: color("{brand}"),
            edge: {
                $type: "border",
                $value: { color: "{brand}", width: { value: 1, unit: "px" }, style: "solid" },
            },
            tint: color({
                colorSpace: "srgb",
                components: [{ $ref: "#/blue/$value/components/2" }, 0, 0],
            }),
            loud: color("{danger}"),
        }),
        "dark.json": JSON.stringify({ brand: color("{blue}") }),
    },
});
const [light, dark] = doc.permutations;
if (!light || !dark) throw new Error("two permutations");

describe("dependencies, in a permutation in hand", () => {
    it("gives the tokens one refers to, in file order", () => {
        expect(paths(dependencies(light, "danger"))).toStrictEqual(["brand"]);
        expect(paths(dependencies(light, "edge"))).toStrictEqual(["brand"]);
        expect(paths(dependencies(light, "brand"))).toStrictEqual(["red"]);
        expect(paths(dependencies(dark, "brand"))).toStrictEqual(["blue"]);
    });

    it("counts a pointer into a token's value as depending on that token", () => {
        expect(paths(dependencies(light, "tint"))).toStrictEqual(["blue"]);
    });

    it("follows chains of references when asked, leaving out the token itself", () => {
        expect(paths(dependencies(light, "loud", { transitive: true }))).toStrictEqual([
            "red",
            "brand",
            "danger",
        ]);
        expect(paths(dependencies(dark, "loud", { transitive: true }))).toStrictEqual([
            "blue",
            "brand",
            "danger",
        ]);
    });

    it("from several tokens at once, leaving out the ones it starts from", () => {
        expect(paths(dependencies(light, ["danger", "tint"]))).toStrictEqual(["blue", "brand"]);
        expect(paths(dependencies(light, ["loud", "brand"], { transitive: true }))).toStrictEqual([
            "red",
            "danger",
        ]);
        expect(dependencies(light, [])).toStrictEqual([]);
    });

    it("gives nothing for a token that refers to none", () => {
        expect(dependencies(light, "red")).toStrictEqual([]);
        expect(dependencies(light, "nowhere")).toStrictEqual([]);
    });

    it("stops at a loop", () => {
        const looped = readFromMemory({
            files: { "tokens.json": JSON.stringify({ a: color("{b}"), b: color("{a}") }) },
        });
        const [only] = looped.permutations;
        if (!only) throw new Error("one permutation");
        expect(paths(dependencies(only, "a", { transitive: true }))).toStrictEqual(["b"]);
    });
});

describe("dependencies, across a document", () => {
    it("gives each path once, with every permutation it is depended on in", () => {
        expect(dependencies(doc, "brand")).toStrictEqual([
            { path: "red", in: [light.input] },
            { path: "blue", in: [dark.input] },
        ]);
        expect(dependencies(doc, "danger")).toStrictEqual([
            { path: "brand", in: [light.input, dark.input] },
        ]);
    });

    it("from several tokens at once", () => {
        expect(dependencies(doc, ["brand", "tint"])).toStrictEqual([
            { path: "red", in: [light.input] },
            { path: "blue", in: [light.input, dark.input] },
        ]);
    });

    it("only in the permutation an input names, when given one", () => {
        expect(dependencies(doc, "brand", { theme: "dark" })).toStrictEqual([
            { path: "blue", in: [dark.input] },
        ]);
        expect(dependencies(doc, "loud", { theme: "dark" }, { transitive: true })).toStrictEqual([
            { path: "blue", in: [dark.input] },
            { path: "brand", in: [dark.input] },
            { path: "danger", in: [dark.input] },
        ]);
    });
});
