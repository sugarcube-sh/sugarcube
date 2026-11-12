import { describe, expect, it } from "vitest";
import { type Span, readFromMemory } from "../../src/index.js";
import { getSpan } from "../../src/editor.js";
import { lightDark, oneFile } from "../token-files.js";

const color = (red: number) => ({ $value: { colorSpace: "srgb", components: [red, 0, 0] } });

const files: Record<string, string> = {
    "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
    "base.json": JSON.stringify({
        color: { $type: "color", bg: color(1), text: color(0) },
    }),
    "dark.json": JSON.stringify({ color: { bg: color(0.1) } }),
};

const tokens = readFromMemory({ files });
const light = tokens.getPermutation({ mode: "light" });
const dark = tokens.getPermutation({ mode: "dark" });
const mode = tokens.resolver?.modifiers[0];
const [lightContext, darkContext] = mode?.contexts ?? [];

function written(span: Span): string {
    return (files[span.file] ?? "").slice(span.offset, span.offset + span.length);
}

describe("sources", () => {
    it("are one object per source the resolver lists, shared by every permutation that reads it", () => {
        expect(light?.sources[0]).toBe(dark?.sources[0]);
        expect(tokens.sources).toStrictEqual([dark?.sources[0], dark?.sources[1]]);
    });

    it("say the modifier whose context lists them, as the resolver's own modifier object", () => {
        const [base, darkFile] = tokens.sources;
        expect(base?.modifier).toBeUndefined();
        expect(darkFile?.modifier).toBe(darkContext?.modifier);
    });

    it("say every set on the way, outermost first, and none when there is none", () => {
        const [base, darkFile] = tokens.sources;
        expect(base?.sets.map(({ name }) => name)).toStrictEqual(["base"]);
        expect(darkFile?.sets).toStrictEqual([]);
        expect(base).not.toHaveProperty("from");
    });

    it("say who reads them: every context, or the contexts that do", () => {
        const [base, darkFile] = tokens.sources;
        expect(base?.contexts).toBe("every-context");
        expect(darkFile?.contexts).toStrictEqual([darkContext]);
    });
});

describe("contexts", () => {
    it("know their modifier, and whether they are its default (Resolver 4.1.5.3)", () => {
        expect(darkContext?.modifier).toBe(mode);
        expect(darkContext?.name).toBe("dark");
        expect(lightContext?.isDefault).toBe(true);
        expect(darkContext?.isDefault).toBe(false);
    });

    it("are none a modifier's default when it declares none (Resolver 6)", () => {
        const undecided = readFromMemory({
            files: {
                ...files,
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        {
                            type: "modifier",
                            name: "mode",
                            contexts: {
                                light: [{ $ref: "base.json" }],
                                dark: [{ $ref: "dark.json" }],
                            },
                        },
                    ],
                }),
            },
        });
        const contexts = undecided.resolver?.modifiers[0]?.contexts ?? [];
        expect(contexts.map(({ isDefault }) => isDefault)).toStrictEqual([false, false]);
    });

    it("are the ones each permutation picks, one per modifier (Resolver 5)", () => {
        expect(light?.contexts).toStrictEqual([lightContext]);
        expect(dark?.contexts[0]).toBe(darkContext);
    });
});

describe("a token's definitions", () => {
    it("is where it is written, with the source that writes it", () => {
        const [place, ...rest] = light.getToken("color.text")?.definitions ?? [];
        expect(rest).toStrictEqual([]);
        expect(place?.source).toBe(tokens.sources[0]);
        expect(place && written(getSpan(tokens, place))).toContain('"colorSpace"');
        expect(place && getSpan(tokens, place).file).toBe("base.json");
    });

    it("is every place a permutation's sources write it, the one that wins last", () => {
        const places = dark.getToken("color.bg")?.definitions ?? [];
        expect(places.map(({ source }) => source.file)).toStrictEqual(["base.json", "dark.json"]);
    });

    it("is the same places in every permutation that reads the same files", () => {
        const inLight = light.getToken("color.text")?.definitions;
        const inDark = dark.getToken("color.text")?.definitions;
        expect(inLight?.[0]).toBe(inDark?.[0]);
    });
});

describe("a group's definitions", () => {
    it("is every place a source declares it, in the order read", () => {
        const places = dark.getGroup("color")?.definitions ?? [];
        expect(places.map(({ source }) => source.file)).toStrictEqual(["base.json", "dark.json"]);
    });

    it("is empty for a group that is only inherited", () => {
        const inherited = oneFile({
            button: { $type: "number", state: { hover: { $value: 1 } } },
            primary: { $extends: "{button}" },
        });
        expect(inherited.getPermutation().getGroup("primary.state")?.definitions).toStrictEqual([]);
    });

    it("of the top level is the top of each file that writes there", () => {
        expect(dark?.topLevel.definitions.map(({ source }) => source.file)).toStrictEqual([
            "base.json",
            "dark.json",
        ]);
    });
});

describe("on the design tokens", () => {
    it("getDefinitions gives every place a path is written, in any permutation, each once with where it is read", () => {
        const places = tokens.getDefinitions("color.bg");
        expect(
            places.map(({ span, permutations }) => [span.file, permutations.inputs]),
        ).toStrictEqual([
            ["base.json", [{ mode: "light" }, { mode: "dark" }]],
            ["dark.json", [{ mode: "dark" }]],
        ]);
    });

    it("getDefinitions gives where each place's value wins: the permutations whose token's value comes from it", () => {
        const places = tokens.getDefinitions("color.bg");
        expect(
            places.map(({ span, winningPermutations }) => [span.file, winningPermutations.inputs]),
        ).toStrictEqual([
            ["base.json", [{ mode: "light" }]],
            ["dark.json", [{ mode: "dark" }]],
        ]);
        expect(places[0]?.winningPermutations).toStrictEqual([light]);
    });

    it("getDefinitions gives a place whose value never wins, as a later source always replaces it, no permutations it wins in", () => {
        const overridden = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                        { type: "set", name: "brand", sources: [{ $ref: "brand.json" }] },
                    ],
                }),
                "base.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }),
                "brand.json": JSON.stringify({ gap: { $type: "number", $value: 2 } }),
            },
        });
        const [base, brand] = overridden.getDefinitions("gap");
        expect(base?.permutations.label).toBe("every permutation");
        expect(base?.winningPermutations.label).toBe("no permutation");
        expect(brand?.winningPermutations.label).toBe("every permutation");
    });

    it("getDefinitions gives a group's places too, read but winning nowhere, as groups merge", () => {
        const places = tokens.getDefinitions("color");
        expect(places.map(({ span }) => span.file)).toStrictEqual(["base.json", "dark.json"]);
        expect(places.map(({ winningPermutations }) => winningPermutations.length)).toStrictEqual([
            0, 0,
        ]);
    });
});

describe("on the design tokens, a file several contexts list", () => {
    const shared = readFromMemory({
        files: {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                sets: { night: { sources: [{ $ref: "night.json" }] } },
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: {
                            light: [],
                            dark: [{ $ref: "#/sets/night" }],
                            dim: [{ $ref: "#/sets/night" }],
                        },
                    },
                ],
            }),
            "base.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }),
            "night.json": JSON.stringify({ gap: { $type: "number", $value: 2 } }),
        },
    });

    it("getDefinitions gives its place once, with the one source both contexts read it through", () => {
        const [, night, ...rest] = shared.getDefinitions("gap");
        expect(rest).toStrictEqual([]);
        expect(night?.span.file).toBe("night.json");
        expect(night?.sources.map(({ modifier }) => modifier?.name)).toStrictEqual(["mode"]);
        expect(night?.permutations.inputs).toStrictEqual([{ mode: "dark" }, { mode: "dim" }]);
    });

    const inDark = shared.getPermutation({ mode: "dark" });
    const inDim = shared.getPermutation({ mode: "dim" });

    it("is one place in every permutation that reads it", () => {
        expect(inDim.getToken("gap")?.winningDefinition).toBe(
            inDark.getToken("gap")?.winningDefinition,
        );
    });

    it("gives the permutations that read it the same token, when nothing else differs", () => {
        expect(inDim.getToken("gap")).toBe(inDark.getToken("gap"));
    });

    it("stays one token across a reread that changes another file", () => {
        const after = shared.reread({
            "base.json": JSON.stringify({
                gap: { $type: "number", $value: 1 },
                rim: { $value: 1 },
            }),
        });

        expect(after.getPermutation({ mode: "dim" }).getToken("gap")).toBe(inDark.getToken("gap"));
        expect(after.getPermutation({ mode: "dark" }).getToken("gap")).toBe(inDark.getToken("gap"));
    });

    it("says which modifier's contexts list it, the permutation saying which context", () => {
        const source = inDim.getToken("gap")?.winningDefinition.source;

        expect(source?.modifier?.name).toBe("mode");
        expect(inDim.contexts.find(({ modifier }) => modifier === source?.modifier)?.name).toBe(
            "dim",
        );
    });

    it("is a place for each route into the file that writes different extensions beside its $ref", () => {
        const routes = readFromMemory({
            files: {
                "tokens.resolver.json": lightDark(
                    ["base.json"],
                    [{ $ref: "night.json", $extensions: { "com.example": { hidden: true } } }],
                    { dim: ["night.json"] },
                ),
                "base.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }),
                "night.json": JSON.stringify({ gap: { $type: "number", $value: 2 } }),
            },
        });
        const throughDark = routes.getPermutation({ mode: "dark" }).getToken("gap");
        const throughDim = routes.getPermutation({ mode: "dim" }).getToken("gap");

        expect(throughDark?.winningDefinition).not.toBe(throughDim?.winningDefinition);
        expect(throughDark?.winningDefinition.source.extensions).toStrictEqual({
            "com.example": { hidden: true },
        });
        expect(throughDim?.winningDefinition.source.extensions).toBeUndefined();
    });
});

describe("the plain form", () => {
    const plain = JSON.parse(JSON.stringify(tokens));

    it("writes a place as its source's position and its span", () => {
        const bg = plain.permutations[1].tokens.find(
            ({ path }: { path: string }) => path === "color.bg",
        );
        expect(bg.definitions.map(({ source }: { source: number }) => source)).toStrictEqual([
            0, 1,
        ]);
        expect(bg).not.toHaveProperty("source");
        expect(bg).not.toHaveProperty("replaces");
    });

    it("leaves out a permutation's contexts, which its input says", () => {
        expect(plain.permutations[1]).not.toHaveProperty("contexts");
    });
});

describe("what is written at a place", () => {
    const placed = readFromMemory({
        files: {
            "tokens.resolver.json": lightDark(["base.json", "all.json#/tokens"], ["dark.json"]),
            "base.json":
                '{\n  "red": { "$type": "color", "$value": "#ff0000", "$description": "Red." }\n}',
            "dark.json": '{ "red": { "$type": "color", "$value": "#990000" } }',
            "all.json": '{ "tokens": { "gap": { "$type": "number", "$value": 4 } } }',
        },
    });

    it("is the JSON the file writes there, exactly as written, for each place", () => {
        const places = placed.getDefinitions("red");

        expect(places.map(({ span, json }) => [span.file, json])).toStrictEqual([
            ["base.json", { $type: "color", $value: "#ff0000", $description: "Red." }],
            ["dark.json", { $type: "color", $value: "#990000" }],
        ]);
        expect(placed.getPermutation().getToken("red")?.definitions[0]?.json).toStrictEqual(
            places[0]?.json,
        );
    });

    it("is found at its place in a file read through a pointer", () => {
        expect(placed.getDefinitions("gap")[0]?.json).toStrictEqual({
            $type: "number",
            $value: 4,
        });
    });

    it("is the same value each time it is read", () => {
        const [place] = placed.getPermutation().getToken("red")?.definitions ?? [];

        expect(place?.json).toBe(place?.json);
    });
});
