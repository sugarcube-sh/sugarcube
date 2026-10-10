import { fillDefaults, readOptions } from "@sugarcube-sh/core";
import { type Input, type Permutation, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { type Hop, describeElidedParents, hopsTo, parentsOf } from "../src/analyze/reach.js";
import { systemOf } from "../src/analyze/system.js";
import { buildFiles, buildFrom } from "../src/build.js";

const perms = (...inputs: Input[]): Permutation[] =>
    inputs.map((input, index) => ({ input, label: `perm ${index}` }) as Permutation);

describe("hopsTo", () => {
    const color = (value: unknown) => ({ $type: "color", $value: value });
    const doc = readFromMemory({
        files: {
            "tokens.resolver.json": JSON.stringify({
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
            }),
            "base.json": JSON.stringify({
                red: color({ colorSpace: "srgb", components: [1, 0, 0] }),
                blue: color({ colorSpace: "srgb", components: [0, 0, 1] }),
                brand: color("{red}"),
                danger: color("{brand}"),
                edge: {
                    $type: "border",
                    $value: { color: "{brand}", width: "{brand}", style: "solid" },
                },
                other: color("{blue}"),
            }),
            "dark.json": JSON.stringify({ brand: color("{blue}") }),
        },
    });
    const [light, dark] = doc.permutations;
    if (!light || !dark) throw new Error("two permutations");

    it("gives each reference on the way to a token once, with the permutations it is in", () => {
        expect(hopsTo([light, dark], "red")).toStrictEqual([
            { from: "brand", to: "red", in: [light] },
            { from: "danger", to: "brand", in: [light] },
            { from: "edge", to: "brand", in: [light] },
        ]);
        expect(hopsTo([light, dark], "blue")).toStrictEqual([
            { from: "other", to: "blue", in: [light, dark] },
            { from: "brand", to: "blue", in: [dark] },
            { from: "danger", to: "brand", in: [dark] },
            { from: "edge", to: "brand", in: [dark] },
        ]);
    });

    it("leaves out a reference whose token the change does not reach in that permutation", () => {
        expect(hopsTo([dark], "red")).toStrictEqual([]);
    });
});

describe("parentsOf", () => {
    it("gives each dependent the tokens one step closer to the target", () => {
        const [light, dark] = perms({ theme: "light" }, { theme: "dark" });
        if (!light || !dark) throw new Error("two");
        const reached: Hop[] = [
            { from: "brand", to: "red", in: [light] },
            { from: "brand", to: "blue", in: [dark] },
            { from: "danger", to: "brand", in: [light, dark] },
        ];

        expect(parentsOf(reached)).toStrictEqual(
            new Map([
                ["brand", ["red", "blue"]],
                ["danger", ["brand"]],
            ]),
        );
    });
});

describe("describeElidedParents", () => {
    const color = (value: unknown) => ({ $type: "color", $value: value });
    const dimension = (value: unknown) => ({ $type: "dimension", $value: value });
    const files = {
        "tokens.resolver.json": {
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                {
                    type: "modifier",
                    name: "theme",
                    default: "light",
                    contexts: {
                        light: [],
                        dark: [{ $ref: "dark.json" }],
                        alt: [{ $ref: "alt.json" }],
                    },
                },
                {
                    type: "modifier",
                    name: "brand",
                    default: "a",
                    contexts: { a: [], b: [{ $ref: "b.json" }] },
                },
                {
                    type: "modifier",
                    name: "debug",
                    default: "off",
                    contexts: { off: [], on: [] },
                },
            ],
        },
        "base.json": {
            blue: color({ colorSpace: "srgb", components: [0, 0, 1] }),
            soft: color("{blue}"),
            strong: color("{blue}"),
            muted: color("{blue}"),
            button: color("{soft}"),
            surface: color("{soft}"),
            mixed: color("{soft}"),
            only: color("{soft}"),
            size: dimension({ value: 1, unit: "px" }),
            small: dimension("{size}"),
            large: dimension("{size}"),
            lift: {
                $type: "shadow",
                $value: {
                    color: "{blue}",
                    offsetX: "{small}",
                    offsetY: "{large}",
                    blur: { value: 0, unit: "px" },
                    spread: { value: 0, unit: "px" },
                },
            },
        },
        "dark.json": {
            button: color("{soft}"),
            surface: color("{strong}"),
            mixed: color("{strong}"),
        },
        "alt.json": { surface: color("{soft}") },
        "b.json": { button: color("{strong}"), mixed: color("{muted}") },
    };
    const labelsFor = async (target: string) => {
        const texts = Object.fromEntries(
            Object.entries(files).map(([name, json]) => [name, JSON.stringify(json)]),
        );
        const system = systemOf(await buildFiles(texts, "/project"));
        return describeElidedParents(hopsTo(system.permutations, target), system);
    };

    it("names the modifier whose files set the token to another reference", async () => {
        expect((await labelsFor("blue")).get("button")).toBe("per brand");
        expect((await labelsFor("blue")).get("surface")).toBe("per theme");
    });

    it("ignores a file that sets the same reference again", async () => {
        const labels = await labelsFor("blue");

        expect(labels.get("button")).toBe("per brand");
        expect(labels.get("surface")).toBe("per theme");
    });

    it("says 'per context' when more than one modifier sets it", async () => {
        expect((await labelsFor("blue")).get("mixed")).toBe("per context");
    });

    it("says nothing about a token with a single parent", async () => {
        expect((await labelsFor("blue")).has("only")).toBe(false);
    });

    it("names the modifier whose files set it, even when another lines up by chance", async () => {
        const config = fillDefaults({
            variables: {
                permutations: [
                    { input: { theme: "light", brand: "a" }, selector: ":root" },
                    { input: { theme: "dark", brand: "b" }, selector: ".dark-b" },
                ],
            },
        });
        const texts = Object.fromEntries(
            Object.entries({ ...files, "dark.json": {} }).map(([name, json]) => [
                name,
                JSON.stringify(json),
            ]),
        );
        const doc = readFromMemory({ files: texts }, readOptions(config));
        const loaded = { config: { ...config, resolver: "tokens.resolver.json" } };
        const system = systemOf(await buildFrom(doc, loaded));

        expect(
            describeElidedParents(hopsTo(system.permutations, "blue"), system).get("button"),
        ).toBe("per brand");
    });

    it("says how many references when the parents don't vary by context", async () => {
        expect((await labelsFor("size")).get("lift")).toBe("2 references");
    });
});
