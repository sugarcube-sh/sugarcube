import { type Input, type Permutation, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import {
    type Hop,
    chooseParents,
    defaultContextParents,
    describeElidedParents,
    hopsTo,
    parentsOf,
} from "../src/analyze/multi-parent.js";

const perms = (...inputs: Input[]): Permutation[] =>
    inputs.map((input, index) => ({ input, label: `perm ${index}` }) as Permutation);

const hops = (from: string, byPermutation: [Permutation, string][]): Hop[] => {
    const found = new Map<string, Permutation[]>();
    for (const [permutation, to] of byPermutation) {
        found.set(to, [...(found.get(to) ?? []), permutation]);
    }
    return [...found].map(([to, within]) => ({ from, to, in: within }));
};

const VARIANTS = ["accent", "danger", "info"];
const perVariant = perms(...VARIANTS.map((variant) => ({ variant })));
const perVariantHops = hops(
    "v.on-strong",
    perVariant.map((permutation, index) => [permutation, `color.${VARIANTS[index]}.on-strong`]),
);

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

describe("chooseParents", () => {
    it("keeps the only parent when there is one", () => {
        const parents = new Map([["child", ["parent"]]]);
        expect(chooseParents(parents, () => 0).get("child")).toBe("parent");
    });

    it("prefers the parent the default context points at, over the most-used one", () => {
        const parents = new Map([["child", ["defaulted", "busy"]]]);
        const uses = (id: string) => (id === "busy" ? 11 : 0);
        const preferred = new Map([["child", "defaulted"]]);

        expect(chooseParents(parents, uses, preferred).get("child")).toBe("defaulted");
    });

    it("falls back to the most-used parent when no context is the default", () => {
        const parents = new Map([["child", ["quiet", "busy"]]]);
        const uses = (id: string) => (id === "busy" ? 11 : 0);

        expect(chooseParents(parents, uses).get("child")).toBe("busy");
    });

    it("breaks ties alphabetically, so runs are reproducible", () => {
        const parents = new Map([["child", ["zeta", "alpha"]]]);
        expect(chooseParents(parents, () => 0).get("child")).toBe("alpha");
    });
});

describe("defaultContextParents", () => {
    it("names the parent reached in the default permutation", () => {
        const [accent, danger] = perms({ variant: "accent" }, { variant: "danger" });
        if (!accent || !danger) throw new Error("two");
        const reached = hops("v.on-strong", [
            [accent, "color.accent.on-strong"],
            [danger, "color.danger.on-strong"],
        ]);

        expect(defaultContextParents(reached, accent).get("v.on-strong")).toBe(
            "color.accent.on-strong",
        );
    });

    it("says nothing when no permutation is the default", () => {
        expect(defaultContextParents(perVariantHops, undefined).size).toBe(0);
    });
});

describe("describeElidedParents", () => {
    it("names the modifier that distinguishes the parents", () => {
        expect(describeElidedParents(perVariantHops).get("v.on-strong")).toBe("per variant");
    });

    it("names whichever modifier the project declared, not a built-in one", () => {
        const [comfortable, compact] = perms({ density: "comfortable" }, { density: "compact" });
        if (!comfortable || !compact) throw new Error("two");
        const reached = hops("space.gap", [
            [comfortable, "space.md"],
            [compact, "space.sm"],
        ]);

        expect(describeElidedParents(reached).get("space.gap")).toBe("per density");
    });

    it("finds the deciding modifier when two modifiers claim the same token", () => {
        const matrix = perms(
            { theme: "light", brand: "a" },
            { theme: "light", brand: "b" },
            { theme: "dark", brand: "a" },
            { theme: "dark", brand: "b" },
        );
        const wins = ["blue", "red", "blue", "red"];
        const reached = hops(
            "color.button",
            matrix.map((permutation, index) => [permutation, `color.${wins[index]}`]),
        );

        expect(describeElidedParents(reached).get("color.button")).toBe("per brand");
    });

    it("ignores a modifier whose values all lead to the same parent", () => {
        const oneAxisEach = perms(
            { theme: "default", brand: "default", variant: "accent" },
            { theme: "alt", brand: "default", variant: "accent" },
            { theme: "pronto", brand: "default", variant: "accent" },
            { theme: "default", brand: "cbus", variant: "accent" },
            { theme: "default", brand: "default", variant: "danger" },
            { theme: "default", brand: "default", variant: "info" },
        );
        const targets = ["accent", "accent", "accent", "accent", "danger", "info"];
        const reached = hops(
            "v.on-strong",
            oneAxisEach.map((permutation, index) => [
                permutation,
                `color.${targets[index]}.on-strong`,
            ]),
        );

        expect(describeElidedParents(reached).get("v.on-strong")).toBe("per variant");
    });

    it("ignores a modifier whose contexts contribute nothing", () => {
        const matrix = perms(
            { variant: "accent", debug: "false" },
            { variant: "accent", debug: "true" },
            { variant: "danger", debug: "false" },
            { variant: "danger", debug: "true" },
        );
        const reached = hops(
            "v.on-strong",
            matrix.map((permutation, index) => [
                permutation,
                `color.${index < 2 ? "accent" : "danger"}.on-strong`,
            ]),
        );

        expect(describeElidedParents(reached).get("v.on-strong")).toBe("per variant");
    });

    it("says nothing about a token with a single parent", () => {
        const reached = hops(
            "color.accent.on-strong",
            perVariant.map((permutation) => [permutation, "color.base.white"]),
        );

        expect(describeElidedParents(reached).has("color.accent.on-strong")).toBe(false);
    });

    it("names the modifier that partitions the parents, not one that merely varies", () => {
        const matrix = perms(
            { variant: "accent", theme: "light" },
            { variant: "accent", theme: "dark" },
            { variant: "danger", theme: "light" },
            { variant: "danger", theme: "dark" },
        );
        const reached = hops(
            "v.on-strong",
            matrix.map((permutation, index) => [
                permutation,
                `color.${index < 2 ? "accent" : "danger"}.on-strong`,
            ]),
        );

        expect(describeElidedParents(reached).get("v.on-strong")).toBe("per variant");
    });

    it("falls back to 'per context' when more than one modifier differs", () => {
        const mixed = perms(
            { variant: "accent", theme: "light" },
            { variant: "danger", theme: "dark" },
        );
        const reached = hops(
            "v.on-strong",
            mixed.map((permutation, index) => [
                permutation,
                `color.${index === 0 ? "accent" : "danger"}.on-strong`,
            ]),
        );

        expect(describeElidedParents(reached).get("v.on-strong")).toBe("per context");
    });

    it("falls back to 'per context' when no one modifier decides the parent", () => {
        const tangled = perms({ a: "1", b: "1" }, { a: "1", b: "2" }, { a: "2", b: "1" });
        const targets = ["x", "y", "y"];
        const reached = hops(
            "v.on-strong",
            tangled.map((permutation, index) => [permutation, `color.${targets[index]}`]),
        );

        expect(describeElidedParents(reached).get("v.on-strong")).toBe("per context");
    });

    it("says how many references when the parents don't vary by context", () => {
        const [only] = perms({});
        if (!only) throw new Error("one");
        const reached = hops("shadow.md", [
            [only, "space.sm"],
            [only, "color.shadow"],
        ]);

        expect(describeElidedParents(reached).get("shadow.md")).toBe("2 references");
    });
});
