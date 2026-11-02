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
        const only = file.getPermutation();

        expect(file.getToken("gap")).toBe(only.getToken("gap"));
        expect(file.getGroup("space")).toBe(only.getGroup("space"));
        expect(file.tokens).toBe(only.tokens);
        expect(file.groups).toBe(only.groups);
        expect(file.children).toBe(only.children);
        expect(file.topLevel).toBe(only.topLevel);
        expect(file.getTokenOrGroup("gap")).toBe(only.getToken("gap"));
        expect(file.getTokenOrGroup("space")).toBe(only.getGroup("space"));
        expect(file.getDependents("gap")).toStrictEqual(only.getDependents("gap"));
        expect(file.getDependencies("gap")).toStrictEqual(only.getDependencies("gap"));
    });

    it("answer for a resolver with no modifiers", () => {
        expect(plainResolver.getToken("gap")).toBe(plainResolver.getPermutation().getToken("gap"));
    });

    it("answer for a read limited to one input, the permutation asked for", () => {
        const dark = readFromMemory(
            { files: JSON.parse(JSON.stringify(oneMode.toMemory().files)) },
            { inputs: [{ mode: "dark" }] },
        );

        expect(dark.getToken("gap")?.resolved).toBe(4);
    });

    it("give undefined for a path that isn't there, as a permutation does", () => {
        expect(file.getToken("nope")).toBeUndefined();
        expect(file.getGroup("gap")).toBeUndefined();
    });
});

describe("the design tokens of a read with several permutations", () => {
    it("refuse to answer for one, and say how to pick", () => {
        const error = refusal(() => oneMode.getToken("gap"));

        expect(error.detail).toStrictEqual({
            asked: "getToken()",
            modifiers: ["mode"],
            example: { mode: "dark" },
        });
        expect(error.message).toBe(
            'tokens.getToken() needs a permutation: this resolver has the modifier `mode`. Pick one with tokens.getPermutation({ mode: "dark" }), or ask them all with askEveryPermutation(tokens, …)',
        );
    });

    it("refuse every question that belongs to one permutation", () => {
        const asks: [string, (tokens: DesignTokens) => unknown][] = [
            ["getToken()", (tokens) => tokens.getToken("gap")],
            ["getGroup()", (tokens) => tokens.getGroup("color")],
            ["tokens", (tokens) => tokens.tokens],
            ["groups", (tokens) => tokens.groups],
            ["children", (tokens) => tokens.children],
            ["topLevel", (tokens) => tokens.topLevel],
            ["getTokenOrGroup()", (tokens) => tokens.getTokenOrGroup("gap")],
            ["getDependents()", (tokens) => tokens.getDependents("color.red")],
            ["getDependencies()", (tokens) => tokens.getDependencies("color.x")],
        ];

        for (const [asked, ask] of asks) {
            expect(refusal(() => ask(modes)).detail).toMatchObject({ asked });
        }
    });

    it("name every modifier, and pick an example away from the defaults", () => {
        const error = refusal(() => modes.getToken("gap"));

        expect(error.detail).toMatchObject({
            modifiers: ["mode", "size"],
            example: { size: "large" },
        });
        expect(error.message).toContain("this resolver has the modifiers `mode` and `size`");
        expect(error.message).toContain('tokens.getPermutation({ size: "large" })');
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

        expect(refusal(() => contrast.getToken("gap")).message).toContain(
            'tokens.getPermutation({ "high-contrast": "on" })',
        );
    });

    it("have no copies of a permutation's questions that answer for every permutation", () => {
        expect("references" in modes).toBe(false);
        expect("resolvedValues" in modes).toBe(false);
        // @ts-expect-error a chained reference is followed in one permutation, so it's asked of one
        modes.getReferencesTo("color.red", { chained: true });
    });

    it("say which way a comparison goes, with getChangesSince, not diff", () => {
        expect("diff" in modes).toBe(false);
        expect(modes.getChangesSince(modes)).toStrictEqual([]);
    });

    it("keep answering what is about the files, not one permutation", () => {
        expect(() => modes.getTokenPaths()).not.toThrow();
        expect(() => modes.has("gap")).not.toThrow();
        expect(() => modes.getDefinitions("gap")).not.toThrow();
        expect(() => modes.getReferencesTo("color.red")).not.toThrow();
        expect(() => modes.getDiagnostics("gap")).not.toThrow();
        expect(() => modes.sources).not.toThrow();
    });
});

describe("a permutation's token or group at a path", () => {
    const read = modes.getPermutation();

    it("is the token there, or the group, or undefined", () => {
        expect(read.getTokenOrGroup("gap")).toBe(read.getToken("gap"));
        expect(read.getTokenOrGroup("color")).toBe(read.getGroup("color"));
        expect(read.getTokenOrGroup("nope")).toBeUndefined();
    });
});

describe("what the top of the files writes", () => {
    it("is the permutation's topLevel, not a $root token", () => {
        const topped = readFromMemory({
            files: {
                "tokens.json": JSON.stringify({
                    $description: "Every token",
                    gap: { $type: "number", $value: 1 },
                }),
            },
        });

        expect(topped.getPermutation().topLevel.description).toBe("Every token");
        expect(topped.getPermutation()).not.toHaveProperty("root");
    });
});

describe("what the root entry gives", () => {
    it("has neither completeInput nor the path helpers one by one, which tokenPath gives, nor anything not built yet", async () => {
        const root = await import("../../src/index.js");
        for (const gone of [
            "completeInput",
            "parentOf",
            "childPath",
            "pathBelow",
            "atOrWithin",
            "withoutRoot",
            "forbiddenInName",
            "permutationLabel",
            "sameJson",
            "sameValue",
            "movedPath",
            "atOffset",
            "toDTCG",
            "toDTCGProject",
            "toDTCGValue",
            "everyPermutation",
            "inputLabel",
            "filePath",
        ]) {
            expect(gone in root).toBe(false);
        }
        for (const kept of ["askEveryPermutation", "toInputLabel", "getFilePath"]) {
            expect(kept in root).toBe(true);
        }
    });
});
