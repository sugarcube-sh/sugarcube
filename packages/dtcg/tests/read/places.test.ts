import { describe, expect, it } from "vitest";
import { type Span, readFromMemory } from "../../src/index.js";
import { getSpan } from "../../src/editor.js";

const color = (red: number) => ({ $value: { colorSpace: "srgb", components: [red, 0, 0] } });

const files: Record<string, string> = {
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
    "base.json": JSON.stringify({
        color: { $type: "color", bg: color(1), text: color(0) },
    }),
    "dark.json": JSON.stringify({ color: { bg: color(0.1) } }),
};

const tokens = readFromMemory({ files, entryFile: "tokens.resolver.json" });
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

    it("say who reads them: everyone, or the contexts that do", () => {
        const [base, darkFile] = tokens.sources;
        expect(base?.readBy).toBe("every-context");
        expect(darkFile?.readBy).toStrictEqual([darkContext]);
    });

    it("are a token file's one source when there is no resolver", () => {
        const single = readFromMemory({ files: { "tokens.json": JSON.stringify({}) } });
        const [only] = single.sources;
        expect(only?.file).toBe("tokens.json");
        expect(only?.sets).toStrictEqual([]);
        expect(only?.readBy).toBe("every-context");
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
            entryFile: "tokens.resolver.json",
        });
        const contexts = undecided.resolver?.modifiers[0]?.contexts ?? [];
        expect(contexts.map(({ isDefault }) => isDefault)).toStrictEqual([false, false]);
    });

    it("are the ones each permutation picks, one per modifier (Resolver 5)", () => {
        expect(light?.contexts).toStrictEqual([lightContext]);
        expect(dark?.contexts[0]).toBe(darkContext);
    });
});

describe("a token's writtenAt", () => {
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

describe("a group's writtenAt", () => {
    it("is every place a source declares it, in the order read", () => {
        const places = dark.getGroup("color")?.definitions ?? [];
        expect(places.map(({ source }) => source.file)).toStrictEqual(["base.json", "dark.json"]);
    });

    it("is empty for a group that is only inherited", () => {
        const inherited = readFromMemory({
            files: {
                "tokens.json": JSON.stringify({
                    button: { $type: "number", state: { hover: { $value: 1 } } },
                    primary: { $extends: "{button}" },
                }),
            },
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
    it("writtenAt gives every place a path is written, in any permutation, each once with where it is read", () => {
        const places = tokens.getDefinitions("color.bg");
        expect(
            places.map(({ span, permutations }) => [span.file, permutations.inputs]),
        ).toStrictEqual([
            ["base.json", [{ mode: "light" }, { mode: "dark" }]],
            ["dark.json", [{ mode: "dark" }]],
        ]);
    });

    it("writtenAt gives where each place's value wins: the permutations whose token's value comes from it", () => {
        const places = tokens.getDefinitions("color.bg");
        expect(places.map(({ span, winsIn }) => [span.file, winsIn.inputs])).toStrictEqual([
            ["base.json", [{ mode: "light" }]],
            ["dark.json", [{ mode: "dark" }]],
        ]);
        expect(places[0]?.winsIn).toStrictEqual([light]);
    });

    it("writtenAt gives a place whose value never wins, as a later source always replaces it, no permutations it wins in", () => {
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
            entryFile: "tokens.resolver.json",
        });
        const [base, brand] = overridden.getDefinitions("gap");
        expect(base?.permutations.label).toBe("everywhere");
        expect(base?.winsIn.label).toBe("nowhere");
        expect(brand?.winsIn.label).toBe("everywhere");
    });

    it("writtenAt gives a group's places too, read but winning nowhere, as groups merge", () => {
        const places = tokens.getDefinitions("color");
        expect(places.map(({ span }) => span.file)).toStrictEqual(["base.json", "dark.json"]);
        expect(places.map(({ winsIn }) => winsIn.length)).toStrictEqual([0, 0]);
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
        entryFile: "tokens.resolver.json",
    });

    it("writtenAt gives its place once, with the one source both contexts read it through", () => {
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
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                        {
                            type: "modifier",
                            name: "mode",
                            default: "light",
                            contexts: {
                                light: [],
                                dark: [
                                    {
                                        $ref: "night.json",
                                        $extensions: { "com.example": { hidden: true } },
                                    },
                                ],
                                dim: [{ $ref: "night.json" }],
                            },
                        },
                    ],
                }),
                "base.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }),
                "night.json": JSON.stringify({ gap: { $type: "number", $value: 2 } }),
            },
            entryFile: "tokens.resolver.json",
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

    it("writes each source once, on the design tokens, and each permutation's sources by position", () => {
        expect(plain.sources.map(({ file }: { file: string }) => file)).toStrictEqual([
            "base.json",
            "dark.json",
        ]);
        expect(
            plain.permutations.map(({ sources }: { sources: number[] }) => sources),
        ).toStrictEqual([[0], [0, 1]]);
    });

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

    it("writes a source's modifier and a context link by name, and a modifier's contexts in full", () => {
        expect(plain.sources[1].modifier).toBe("mode");
        expect(plain.sources[1].readBy).toStrictEqual([{ modifier: "mode", name: "dark" }]);
        const [, darkWritten] = plain.resolver.modifiers[0].contexts;
        expect(Object.keys(darkWritten).sort()).toStrictEqual(["name", "sources", "span"]);
    });

    it("leaves out a permutation's contexts, which its input says", () => {
        expect(plain.permutations[1]).not.toHaveProperty("contexts");
    });
});

describe("what is written at a place", () => {
    const placed = readFromMemory({
        files: {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "set",
                        name: "base",
                        sources: [{ $ref: "base.json" }, { $ref: "all.json#/tokens" }],
                    },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                    },
                ],
            }),
            "base.json":
                '{\n  "red": { "$type": "color", "$value": "#ff0000", "$description": "Red." }\n}',
            "dark.json": '{ "red": { "$type": "color", "$value": "#990000" } }',
            "all.json": '{ "tokens": { "gap": { "$type": "number", "$value": 4 } } }',
        },
    });

    it("is the JSON the file writes there, exactly as written, for each place", () => {
        const places = placed.getDefinitions("red");

        expect(places.map(({ span, asWritten: json }) => [span.file, json])).toStrictEqual([
            ["base.json", { $type: "color", $value: "#ff0000", $description: "Red." }],
            ["dark.json", { $type: "color", $value: "#990000" }],
        ]);
        expect(placed.getPermutation().getToken("red")?.definitions[0]?.asWritten).toStrictEqual(
            places[0]?.asWritten,
        );
    });

    it("is found at its place in a file read through a pointer", () => {
        expect(placed.getDefinitions("gap")[0]?.asWritten).toStrictEqual({
            $type: "number",
            $value: 4,
        });
    });

    it("is the same value each time it is read", () => {
        const [place] = placed.getPermutation().getToken("red")?.definitions ?? [];

        expect(place?.asWritten).toBe(place?.asWritten);
    });
});
