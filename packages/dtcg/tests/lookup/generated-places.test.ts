import { describe, expect, it } from "vitest";
import { defineGenerator, readFromMemory } from "../../src/index.js";
import { getSpan } from "../../src/editor.js";

const steps = defineGenerator({
    extension: ["com.example", "steps"],
    messages: {},
    generate: () => ({ ok: true, value: [{ name: "a", $value: "{base}" }] }),
});

const tokens = readFromMemory(
    {
        files: {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [] },
                    },
                ],
            }),
            "tokens.json": JSON.stringify({
                base: { $type: "number", $value: 1 },
                g: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
            }),
        },
        entry: "tokens.resolver.json",
    },
    { generators: [steps] },
);

describe("generated tokens across permutations", () => {
    it("is written in one place, read in every permutation", () => {
        const places = tokens.getDefinitions("g.a");
        expect(places.map(({ permutations: readIn }) => readIn.label)).toStrictEqual([
            "everywhere",
        ]);
    });

    it("is one reference to what it references, in every permutation", () => {
        const references = tokens.getReferencesTo("base");
        expect(
            references.map(({ writtenInPaths: fromPaths, permutations }) => [
                fromPaths,
                permutations.label,
            ]),
        ).toStrictEqual([[["g.a"], "everywhere"]]);
    });

    it("has the same span in every permutation", () => {
        const [light, dark] = tokens.permutations;
        const [inLight, inDark] = [light?.getToken("g.a"), dark?.getToken("g.a")];
        if (!inLight || !inDark) throw new Error("g.a is not generated in both");
        expect(getSpan(tokens, inLight.winningDefinition)).toBe(
            getSpan(tokens, inDark.winningDefinition),
        );
    });

    it("are one reference, with each token, when a generator makes several from one setting", () => {
        const two = defineGenerator({
            extension: ["com.example", "steps"],
            messages: {},
            generate: () => ({
                ok: true,
                value: [
                    { name: "a", $value: "{base}" },
                    { name: "b", $value: "{base}" },
                ],
            }),
        });
        const both = readFromMemory(
            {
                files: {
                    "tokens.json": JSON.stringify({
                        base: { $type: "number", $value: 1 },
                        g: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                    }),
                },
            },
            { generators: [two] },
        );
        expect(
            both.getReferencesTo("base").map(({ writtenInPaths: fromPaths }) => fromPaths),
        ).toStrictEqual([["g.a", "g.b"]]);
    });
});

describe("a name a generator gives", () => {
    const named = defineGenerator({
        extension: ["com.example", "steps"],
        messages: {},
        generate: () => ({
            ok: true,
            value: ["a.b", "$x", "c{d", "ok"].map((name) => ({ name, $value: 1 })),
        }),
    });
    const badlyNamed = readFromMemory(
        {
            files: {
                "tokens.json": JSON.stringify({
                    g: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                }),
            },
        },
        { generators: [named] },
    );

    it("makes no token when the specification forbids the name", () => {
        expect(badlyNamed.getPermutation().tokens.map(({ path }) => path)).toStrictEqual(["g.ok"]);
    });

    it("is reported at the generator's setting, about its group", () => {
        expect(
            badlyNamed.diagnostics.map(({ kind, detail, path, span }) => [
                kind,
                detail,
                path,
                span?.file,
            ]),
        ).toStrictEqual([
            ["invalid-name", { name: "a.b", character: "." }, "g", "tokens.json"],
            ["invalid-name", { name: "$x", character: "$" }, "g", "tokens.json"],
            ["invalid-name", { name: "c{d", character: "{" }, "g", "tokens.json"],
        ]);
    });
});
