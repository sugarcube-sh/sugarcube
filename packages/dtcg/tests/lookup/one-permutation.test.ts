import { describe, expect, it } from "vitest";
import { type DesignTokens, SeveralPermutationsError, readFromMemory } from "../../src/index.js";
import { twoModifiers } from "./two-modifiers.js";

const number = (value: number) => ({ $type: "number", $value: value });

const file = readFromMemory({
    files: {
        "tokens.json": JSON.stringify({
            space: { sm: number(1), md: number(2) },
            gap: number(3),
        }),
    },
});

const plainResolver = readFromMemory({
    files: {
        "tokens.resolver.json": JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
        }),
        "base.json": JSON.stringify({ gap: number(3) }),
    },
});

const oneMode = readFromMemory({
    files: {
        "tokens.resolver.json": JSON.stringify({
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
        }),
        "base.json": JSON.stringify({ gap: number(3) }),
        "dark.json": JSON.stringify({ gap: number(4) }),
    },
});

const modes = twoModifiers();

function refusal(ask: () => unknown): SeveralPermutationsError {
    try {
        ask();
    } catch (error) {
        if (error instanceof SeveralPermutationsError) return error;
        throw error;
    }
    throw new Error("expected a SeveralPermutationsError");
}

describe("the design tokens of a read with one permutation", () => {
    it("answer a token file's questions directly, as its one permutation does", () => {
        const only = file.permutation();

        expect(file.token("gap")).toBe(only.token("gap"));
        expect(file.group("space")).toBe(only.group("space"));
        expect(file.tokens).toBe(only.tokens);
        expect(file.groups).toBe(only.groups);
        expect(file.children).toBe(only.children);
        expect(file.root).toBe(only.root);
        expect(file.usedBy("gap")).toStrictEqual(only.usedBy("gap"));
        expect(file.refersTo("gap")).toStrictEqual(only.refersTo("gap"));
    });

    it("answer for a resolver with no modifiers", () => {
        expect(plainResolver.token("gap")).toBe(plainResolver.permutation().token("gap"));
    });

    it("answer for a read limited to one input, the permutation asked for", () => {
        const dark = readFromMemory(
            { files: JSON.parse(JSON.stringify(oneMode.toMemory().files)) },
            { inputs: [{ mode: "dark" }] },
        );

        expect(dark.token("gap")?.resolved).toBe(4);
    });

    it("give undefined for a path that isn't there, as a permutation does", () => {
        expect(file.token("nope")).toBeUndefined();
        expect(file.group("gap")).toBeUndefined();
    });
});

describe("the design tokens of a read with several permutations", () => {
    it("refuse to answer for one, and say how to pick", () => {
        const error = refusal(() => oneMode.token("gap"));

        expect(error.detail).toStrictEqual({
            asked: "token()",
            modifiers: ["mode"],
            example: { mode: "dark" },
        });
        expect(error.message).toBe(
            'tokens.token() needs a permutation: this resolver has the modifier `mode`. Pick one with tokens.permutation({ mode: "dark" }), or ask them all with everyPermutation(tokens, …)',
        );
    });

    it("refuse every question that belongs to one permutation", () => {
        const asks: [string, (tokens: DesignTokens) => unknown][] = [
            ["token()", (tokens) => tokens.token("gap")],
            ["group()", (tokens) => tokens.group("color")],
            ["tokens", (tokens) => tokens.tokens],
            ["groups", (tokens) => tokens.groups],
            ["children", (tokens) => tokens.children],
            ["root", (tokens) => tokens.root],
            ["usedBy()", (tokens) => tokens.usedBy("color.red")],
            ["refersTo()", (tokens) => tokens.refersTo("color.x")],
        ];

        for (const [asked, ask] of asks) {
            expect(refusal(() => ask(modes)).detail).toMatchObject({ asked });
        }
    });

    it("name every modifier, and pick an example away from the defaults", () => {
        const error = refusal(() => modes.token("gap"));

        expect(error.detail).toMatchObject({
            modifiers: ["mode", "size"],
            example: { size: "large" },
        });
        expect(error.message).toContain("this resolver has the modifiers `mode` and `size`");
        expect(error.message).toContain('tokens.permutation({ size: "large" })');
    });

    it("quote a modifier's name in the example when it isn't a plain name", () => {
        const contrast = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                        {
                            type: "modifier",
                            name: "high-contrast",
                            default: "off",
                            contexts: { off: [], on: [] },
                        },
                    ],
                }),
                "base.json": JSON.stringify({ gap: number(3) }),
            },
        });

        expect(refusal(() => contrast.token("gap")).message).toContain(
            'tokens.permutation({ "high-contrast": "on" })',
        );
    });

    it("have no copies of a permutation's questions that answer for every permutation", () => {
        expect("references" in modes).toBe(false);
        expect("resolvedValues" in modes).toBe(false);
        // @ts-expect-error a chained reference is followed in one permutation, so it's asked of one
        modes.referencedBy("color.red", { chained: true });
    });

    it("keep answering what is about the files, not one permutation", () => {
        expect(() => modes.tokenPaths()).not.toThrow();
        expect(() => modes.has("gap")).not.toThrow();
        expect(() => modes.writtenAt("gap")).not.toThrow();
        expect(() => modes.referencedBy("color.red")).not.toThrow();
        expect(() => modes.diagnosticsFor("gap")).not.toThrow();
        expect(() => modes.sources).not.toThrow();
    });
});
