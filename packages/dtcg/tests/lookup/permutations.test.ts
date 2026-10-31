import { describe, expect, it } from "vitest";
import { type DesignTokens, type ReadOptions, readFromMemory } from "../../src/index.js";

const number = (value: number) => ({ $type: "number", $value: value });

const resolver = {
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }] } },
    modifiers: {
        mode: {
            contexts: { light: [], dark: [{ $ref: "dark.json" }], sepia: [{ $ref: "dark.json" }] },
            default: "light",
        },
        density: {
            contexts: { comfy: [], compact: [{ $ref: "compact.json" }] },
            default: "comfy",
        },
    },
    resolutionOrder: [
        { $ref: "#/sets/base" },
        { $ref: "#/modifiers/mode" },
        { $ref: "#/modifiers/density" },
    ],
};

const files = {
    "tokens.resolver.json": JSON.stringify(resolver),
    "base.json": JSON.stringify({ gap: number(1), red: number(1), text: number(1) }),
    "dark.json": JSON.stringify({ text: { $type: "number", $value: "{red}" } }),
    "compact.json": JSON.stringify({ gap: number(2) }),
};

function readWith(options?: ReadOptions): DesignTokens {
    return readFromMemory({ files, entry: "tokens.resolver.json" }, options);
}

const tokens = readWith();
const named = (input: Record<string, string>) => tokens.permutation(input);

describe("a permutation's label", () => {
    it("names every modifier and its context, in the resolver's order", () => {
        expect(named({ mode: "dark" }).label).toBe("mode: dark, density: comfy");
        expect(named({ density: "compact" }).label).toBe("mode: light, density: compact");
        expect(named({ mode: "sepia", density: "compact" }).label).toBe(
            "mode: sepia, density: compact",
        );
    });

    it("names the default permutation's contexts, as any other's", () => {
        expect(named({}).label).toBe("mode: light, density: comfy");
    });

    it("is the label of a list holding only that permutation", () => {
        for (const permutation of tokens.permutations) {
            expect(tokens.permutations.where((each) => each === permutation).label).toBe(
                permutation.label,
            );
        }
    });

    it("always names a modifier with no default, as every input must", () => {
        const { default: _, ...noDefault } = resolver.modifiers.mode;
        const required = readFromMemory({
            files: {
                ...files,
                "tokens.resolver.json": JSON.stringify({
                    ...resolver,
                    modifiers: { ...resolver.modifiers, mode: noDefault },
                }),
            },
            entry: "tokens.resolver.json",
        });
        expect(required.permutations.map(({ label }) => label)).toStrictEqual([
            "mode: light, density: comfy",
            "mode: light, density: compact",
            "mode: dark, density: comfy",
            "mode: dark, density: compact",
            "mode: sepia, density: comfy",
            "mode: sepia, density: compact",
        ]);
    });

    it("is empty without a resolver, with nothing to name", () => {
        const plain = readFromMemory({ files: { "base.json": files["base.json"] } });
        expect(plain.permutations[0]?.label).toBe("");
    });
});

describe("tokens.permutations", () => {
    it("is every permutation the read built, as a list", () => {
        expect(tokens.permutations).toHaveLength(6);
        expect(tokens.permutations[0]).toBe(named({}));
        expect(
            tokens.permutations.find((each) => each.label === "mode: dark, density: compact"),
        ).toBe(named({ mode: "dark", density: "compact" }));
    });

    it("is everywhere: one part that narrows nothing", () => {
        expect(tokens.permutations.scope).toStrictEqual([{}]);
        expect(tokens.permutations.label).toBe("everywhere");
    });

    it("is every permutation, with none other", () => {
        expect(tokens.permutations.others).toHaveLength(0);
        expect(tokens.permutations.others.label).toBe("nowhere");
    });

    it("gives the inputs, in the same order", () => {
        expect(tokens.permutations.inputs).toStrictEqual(
            tokens.permutations.map(({ input }) => input),
        );
    });
});

describe("permutations.where", () => {
    it("gives the permutations that pass the test, labelled against every permutation", () => {
        const dark = tokens.permutations.where((each) => each.input.mode === "dark");
        expect(dark.inputs).toStrictEqual([
            { mode: "dark", density: "comfy" },
            { mode: "dark", density: "compact" },
        ]);
        expect(dark.scope).toStrictEqual([{ mode: ["dark"] }]);
        expect(dark.label).toBe("mode: dark");
        expect(dark.others.inputs).toStrictEqual([
            { mode: "light", density: "comfy" },
            { mode: "light", density: "compact" },
            { mode: "sepia", density: "comfy" },
            { mode: "sepia", density: "compact" },
        ]);
        expect(dark.others.label).toBe("mode: light, sepia");
        expect(dark.others.others).toStrictEqual(dark);
        expect(dark.others).toBe(dark.others);
    });

    it("narrows again, labelled against every permutation still", () => {
        const darkCompact = tokens.permutations
            .where((each) => each.input.mode === "dark")
            .where((each) => each.input.density === "compact");
        expect(darkCompact.label).toBe("mode: dark, density: compact");
    });

    it("is everywhere when every permutation passes, and is written as its inputs", () => {
        const every = tokens.permutations.where(() => true);
        expect(every.scope).toStrictEqual([{}]);
        expect(every.label).toBe("everywhere");
        expect(every.others).toHaveLength(0);
        expect(JSON.parse(JSON.stringify(every))).toStrictEqual(every.inputs);
    });

    it("is nowhere when no permutation passes", () => {
        const none = tokens.permutations.where(() => false);
        expect(none.scope).toStrictEqual([]);
        expect(none.label).toBe("nowhere");
        expect([...none.others]).toStrictEqual([...tokens.permutations]);
    });

    it("gives the permutations themselves, in their order", () => {
        const sepia = tokens.permutations.where((each) => each.input.mode === "sepia");
        expect([...sepia]).toStrictEqual(
            tokens.permutations.filter((each) => each.input.mode === "sepia"),
        );
    });
});

describe("permutations.matching", () => {
    it("finds the permutation an input names, filling each modifier it leaves out with its default", () => {
        const dark = tokens.permutations.matching({ mode: "dark" });

        expect(dark?.input).toStrictEqual({ mode: "dark", density: "comfy" });
    });

    it("fills a default that isn't the modifier's first context", () => {
        const compactFirst = readFromMemory({
            files: {
                ...files,
                "tokens.resolver.json": JSON.stringify({
                    ...resolver,
                    modifiers: {
                        ...resolver.modifiers,
                        density: { ...resolver.modifiers.density, default: "compact" },
                    },
                }),
            },
            entry: "tokens.resolver.json",
        });

        expect(compactFirst.permutations.matching({ mode: "dark" })?.input).toStrictEqual({
            mode: "dark",
            density: "compact",
        });
    });

    it("is the permutation tokens.permutation gives, the same object", () => {
        expect(tokens.permutations.matching({ mode: "dark" })).toBe(named({ mode: "dark" }));
        expect(tokens.permutations.matching({})).toBe(named({}));
    });

    it("matches modifier and context names whatever their case, as the resolver spec asks", () => {
        expect(tokens.permutations.matching({ Mode: "DARK" })).toBe(named({ mode: "dark" }));
    });

    it("is nothing for a context or a modifier the resolver doesn't have", () => {
        expect(tokens.permutations.matching({ mode: "neon" })).toBeUndefined();
        expect(tokens.permutations.matching({ shape: "round" })).toBeUndefined();
    });

    it("is nothing for a combination the read didn't build", () => {
        const each = readWith({ permutations: "each-context" });

        expect(each.permutations.matching({ mode: "dark", density: "compact" })).toBeUndefined();
        expect(each.permutations.matching({ density: "compact" })?.input).toStrictEqual({
            mode: "light",
            density: "compact",
        });
    });

    it("finds only among the permutations the list holds", () => {
        const darkOnes = tokens.permutations.where(({ input }) => input.mode === "dark");

        expect(darkOnes.matching({ mode: "dark" })).toBe(named({ mode: "dark" }));
        expect(darkOnes.matching({})).toBeUndefined();
    });
});

describe("the permutations an answer holds in", () => {
    const [reference] = tokens.referencedBy("red");

    it("are the permutations themselves", () => {
        expect(reference?.permutations).toContain(named({ mode: "dark" }));
        expect(reference?.permutations).not.toContain(named({}));
    });

    it("are labelled by the contexts they share: one modifier, several contexts", () => {
        expect(reference?.permutations.label).toBe("mode: dark, sepia");
    });

    it("are labelled by each modifier that narrows them, in the resolver's order", () => {
        const compact = tokens.writtenAt("gap").find(({ span }) => span.file === "compact.json");
        expect(compact?.readIn.label).toBe("density: compact");
    });

    it("are everywhere when they are every permutation", () => {
        const [base] = tokens.writtenAt("red");
        expect(base?.readIn).toHaveLength(6);
        expect(base?.readIn.label).toBe("everywhere");
    });

    it("are written in the plain form as their inputs", () => {
        expect(JSON.parse(JSON.stringify(reference?.permutations))).toStrictEqual(
            reference?.permutations.inputs,
        );
    });

    it("share one scope with every answer that holds in the same permutations", () => {
        const [red] = tokens.writtenAt("red");
        const [text] = tokens.writtenAt("text");
        expect(red?.readIn).not.toBe(text?.readIn);
        expect(red?.readIn.scope).toBe(text?.readIn.scope);
    });
});

describe("a label", () => {
    const themed = readWith({ permutations: "each-context" });

    it("names a modifier when leaving it out would take in combinations the read didn't build", () => {
        const [reference] = themed.referencedBy("red");
        expect(reference?.permutations).toHaveLength(2);
        expect(reference?.permutations.label).toBe("mode: dark, sepia, density: comfy");
        const compact = themed.writtenAt("gap").find(({ span }) => span.file === "compact.json");
        expect(compact?.readIn.label).toBe("mode: light, density: compact");
    });

    it("names each modifier that narrows it, in the resolver's order", () => {
        const glowing = readFromMemory({
            files: {
                ...files,
                "dark.json": JSON.stringify({ glow: number(4) }),
                "compact.json": JSON.stringify({ gap: { $type: "number", $value: "{glow}" } }),
            },
            entry: "tokens.resolver.json",
        });
        const problem = glowing.diagnostics.find(({ kind }) => kind === "missing-reference");
        expect(problem?.permutations).toHaveLength(1);
        expect(problem?.permutations?.label).toBe("mode: light, density: compact");
    });

    it("joins parts that each match only permutations it holds, when one choice per modifier cannot", () => {
        const both = {
            ...resolver,
            modifiers: {
                mode: {
                    ...resolver.modifiers.mode,
                    contexts: { light: [], dark: [{ $ref: "shared.json" }], sepia: [] },
                },
                density: {
                    ...resolver.modifiers.density,
                    contexts: { comfy: [], compact: [{ $ref: "shared.json" }] },
                },
            },
        };
        const crossed = readFromMemory({
            files: {
                ...files,
                "tokens.resolver.json": JSON.stringify(both),
                "shared.json": JSON.stringify({ gap: number(3) }),
            },
            entry: "tokens.resolver.json",
        });
        const shared = crossed.writtenAt("gap").find(({ span }) => span.file === "shared.json");
        expect(shared?.readIn).toHaveLength(4);
        expect(shared?.readIn.scope).toStrictEqual([{ density: ["compact"] }, { mode: ["dark"] }]);
        expect(shared?.readIn.label).toBe("density: compact; mode: dark");
    });

    it("says which combinations the read built, rather than everywhere, when it built only some", () => {
        expect(themed.permutations.scope).toStrictEqual([
            { density: ["comfy"] },
            { mode: ["light"] },
        ]);
        expect(themed.permutations.label).toBe("density: comfy; mode: light");
    });

    it("gathers contexts of one modifier into a part, as with a resolver's chosen permutations", () => {
        const picked = themed.permutations.where((each) => !each.isDefault);
        expect(picked.scope).toStrictEqual([
            { mode: ["dark", "sepia"], density: ["comfy"] },
            { mode: ["light"], density: ["compact"] },
        ]);
        expect(picked.label).toBe(
            "mode: dark, sepia, density: comfy; mode: light, density: compact",
        );
    });

    it("names a modifier at its default where leaving it out would take in more", () => {
        const dark = named({ mode: "dark" });
        const alone = tokens.permutations.where((each) => each === dark);
        expect(alone.scope).toStrictEqual([{ mode: ["dark"], density: ["comfy"] }]);
        expect(alone.label).toBe("mode: dark, density: comfy");
        expect(dark.label).toBe(alone.label);
    });

    it("writes a part that matches only the default permutation as its contexts", () => {
        const ends = tokens.permutations.where(
            (each) => each.isDefault || each === named({ mode: "dark", density: "compact" }),
        );
        expect(ends.scope).toStrictEqual([
            { mode: ["light"], density: ["comfy"] },
            { mode: ["dark"], density: ["compact"] },
        ]);
        expect(ends.label).toBe("mode: light, density: comfy; mode: dark, density: compact");
    });

    describe("of a read that built only some of the resolver's combinations", () => {
        const some = readWith({ inputs: [{}, { mode: "dark" }, { density: "compact" }] });

        it("names a modifier that leaving out would take in a combination the read didn't build", () => {
            const dark = some.permutation({ mode: "dark" });
            const alone = some.permutations.where((each) => each === dark);
            expect(alone.scope).toStrictEqual([{ mode: ["dark"], density: ["comfy"] }]);
            expect(alone.label).toBe(dark.label);
        });

        it("isn't everywhere, though it holds every permutation the read built", () => {
            expect(some.permutations).toHaveLength(3);
            expect(some.permutations.label).not.toBe("everywhere");
            expect(some.permutations.scope).not.toStrictEqual([{}]);
            expect(some.permutations.others).toHaveLength(0);
        });
    });
});

describe("a scope", () => {
    it("lists each modifier's contexts in the order the modifier writes them", () => {
        const modifier = (name: string) => ({
            contexts: { [`${name}0`]: [], [`${name}1`]: [], [`${name}2`]: [] },
            default: `${name}0`,
        });
        const three = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    sets: { base: { sources: [{ $ref: "base.json" }] } },
                    modifiers: { a: modifier("a"), b: modifier("b"), c: modifier("c") },
                    resolutionOrder: [
                        { $ref: "#/sets/base" },
                        { $ref: "#/modifiers/a" },
                        { $ref: "#/modifiers/b" },
                        { $ref: "#/modifiers/c" },
                    ],
                }),
                "base.json": "{}",
            },
            entry: "tokens.resolver.json",
        });
        const inputs: Record<string, string>[] = [
            {},
            { c: "c1" },
            { a: "a2" },
            { a: "a2", c: "c1" },
            { a: "a2", c: "c2" },
            { a: "a2", b: "b1" },
            { a: "a2", b: "b1", c: "c2" },
            { a: "a2", b: "b2" },
            { a: "a2", b: "b2", c: "c2" },
        ];
        const picked = inputs.map((input) => three.permutation(input));
        const some = three.permutations.where((each) => picked.includes(each));
        expect(some.scope).toStrictEqual([
            { a: ["a0", "a2"], b: ["b0"], c: ["c0", "c1"] },
            { a: ["a2"], c: ["c0", "c2"] },
        ]);
    });
});

describe("a problem's permutations", () => {
    const broken = readFromMemory({
        files: {
            ...files,
            "dark.json": JSON.stringify({ text: { $type: "number", $value: "{missing}" } }),
        },
        entry: "tokens.resolver.json",
    });
    const problem = broken.diagnostics.find(({ kind }) => kind === "missing-reference");

    it("are the permutations themselves, labelled", () => {
        expect(problem?.permutations).toContain(broken.permutation({ mode: "dark" }));
        expect(problem?.permutations?.label).toBe("mode: dark, sepia");
    });

    it("are every permutation, labelled everywhere, when the problem is in every permutation", () => {
        const everywhere = readFromMemory({
            files: {
                ...files,
                "base.json": JSON.stringify({
                    gap: number(1),
                    red: { $type: "number", $value: "{missing}" },
                    text: number(1),
                }),
            },
            entry: "tokens.resolver.json",
        });
        const found = everywhere.diagnostics.filter(({ kind }) => kind === "missing-reference");
        expect(found).toHaveLength(1);
        expect(found[0]?.permutations.label).toBe("everywhere");
        expect(found[0]?.permutations).toHaveLength(everywhere.permutations.length);
    });

    it("are written in the plain form as their inputs", () => {
        const written = JSON.parse(JSON.stringify(broken)).diagnostics.find(
            ({ kind }: { kind: string }) => kind === "missing-reference",
        );
        expect(written.permutations).toStrictEqual([
            { mode: "dark", density: "comfy" },
            { mode: "dark", density: "compact" },
            { mode: "sepia", density: "comfy" },
            { mode: "sepia", density: "compact" },
        ]);
    });
});

describe("the plain form of the design tokens", () => {
    it("writes each permutation in full", () => {
        const written = JSON.parse(JSON.stringify(tokens));
        expect(written.permutations[0]).toHaveProperty("tokens");
        expect(written.permutations[0].input).toStrictEqual({ mode: "light", density: "comfy" });
    });
});
