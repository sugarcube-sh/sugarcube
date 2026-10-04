import { describe, expect, it } from "vitest";
import { type Token, readFromMemory, referrers } from "../../src/index.js";

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

describe("referrers, in a permutation in hand", () => {
    it("gives the tokens that refer to one, in file order", () => {
        expect(paths(referrers(light, "brand"))).toStrictEqual(["danger", "edge"]);
        expect(paths(referrers(light, "red"))).toStrictEqual(["brand"]);
        expect(paths(referrers(dark, "red"))).toStrictEqual([]);
    });

    it("counts a pointer into a token's value as referring to that token", () => {
        expect(paths(referrers(light, "blue"))).toStrictEqual(["tint"]);
        expect(paths(referrers(dark, "blue"))).toStrictEqual(["brand", "tint"]);
    });

    it("follows chains of references when asked, leaving out the token itself", () => {
        expect(paths(referrers(light, "red", { transitive: true }))).toStrictEqual([
            "brand",
            "danger",
            "edge",
            "loud",
        ]);
    });

    it("gives nothing for a path no token refers to", () => {
        expect(referrers(light, "loud")).toStrictEqual([]);
        expect(referrers(light, "nowhere")).toStrictEqual([]);
    });

    it("stops at a loop", () => {
        const looped = readFromMemory({
            files: { "tokens.json": JSON.stringify({ a: color("{b}"), b: color("{a}") }) },
        });
        const [only] = looped.permutations;
        if (!only) throw new Error("one permutation");
        expect(paths(referrers(only, "a", { transitive: true }))).toStrictEqual(["b"]);
    });
});

describe("referrers, across a document", () => {
    it("gives each referring path once, with every permutation it refers in", () => {
        expect(referrers(doc, "blue")).toStrictEqual([
            { path: "tint", in: [light.input, dark.input] },
            { path: "brand", in: [dark.input] },
        ]);
    });

    it("only in the permutation an input names, when given one", () => {
        expect(referrers(doc, "blue", { theme: "light" })).toStrictEqual([
            { path: "tint", in: [light.input] },
        ]);
        expect(referrers(doc, "red", { theme: "dark" }, { transitive: true })).toStrictEqual([]);
    });
});

describe("each permutation's edges", () => {
    it("hold one edge per reference, in that permutation only", () => {
        const edges = (each: typeof light) => each.edges.map(({ from, to }) => `${from}→${to}`);
        expect(edges(light)).toStrictEqual([
            "brand→red",
            "danger→brand",
            "edge→brand",
            "tint→blue",
            "loud→danger",
        ]);
        expect(edges(dark)).toContain("brand→blue");
        expect(edges(dark)).not.toContain("brand→red");
    });
});
