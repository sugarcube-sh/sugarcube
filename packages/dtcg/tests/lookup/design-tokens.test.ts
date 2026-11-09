import { describe, expect, it } from "vitest";
import {
    type DesignTokens,
    type Input,
    PermutationError,
    toInputLabel,
    readFromMemory,
} from "../../src/index.js";
import { thrownBy } from "./thrown.js";

const px = (value: number) => ({ $value: { value, unit: "px" } });

const resolver = {
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }] } },
    modifiers: {
        theme: {
            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            default: "light",
        },
        density: {
            contexts: { comfy: [], compact: [{ $ref: "compact.json" }] },
            default: "comfy",
        },
    },
    resolutionOrder: [
        { $ref: "#/sets/base" },
        { $ref: "#/modifiers/theme" },
        { $ref: "#/modifiers/density" },
    ],
};

const files = {
    "tokens.resolver.json": JSON.stringify(resolver),
    "base.json": `{
        "px": { "$type": "dimension", "$value": { "value": 1, "unit": "px" } },
        "2": { "$type": "dimension", "$value": { "value": 2, "unit": "px" } },
        "1": { "$type": "dimension", "$value": { "value": 1, "unit": "px" } },
        "space": {
            "$type": "dimension",
            "$root": ${JSON.stringify(px(8))},
            "sm": ${JSON.stringify(px(4))},
            "inset": { "lg": ${JSON.stringify(px(16))} }
        },
        "spacer": { "$type": "dimension", "x": ${JSON.stringify(px(2))} }
    }`,
    "dark.json": `{
        "glow": { "$type": "dimension", "$value": { "value": 4, "unit": "px" } },
        "2": { "$type": "dimension", "$value": { "value": 3, "unit": "px" } }
    }`,
    "compact.json": `{ "space": { "sm": ${JSON.stringify(px(2))} } }`,
};

function readWith(inputs?: Input[]): DesignTokens {
    return readFromMemory({ files }, inputs && { inputs });
}

const tokens = readWith();
const light = tokens.getPermutation();
const dark = tokens.getPermutation({ theme: "dark" });
const paths = (items: readonly { path: string }[] | undefined) => items?.map(({ path }) => path);
const valueOf = (found: ReturnType<typeof light.getToken>) =>
    found?.type === "dimension" ? found.resolved?.value : undefined;

const single = readFromMemory({ files: { "tokens.json": files["base.json"] } });

const noDefault = readFromMemory({
    files: {
        ...files,
        "tokens.resolver.json": JSON.stringify({
            ...resolver,
            modifiers: { theme: { contexts: resolver.modifiers.theme.contexts } },
            resolutionOrder: resolver.resolutionOrder.slice(0, 2),
        }),
    },
});

describe("tokens.getPermutation", () => {
    it("is the permutation for a full input", () => {
        expect(tokens.getPermutation({ theme: "dark", density: "compact" }).input).toStrictEqual({
            theme: "dark",
            density: "compact",
        });
        expect(noDefault.getPermutation({ theme: "dark" }).input).toStrictEqual({ theme: "dark" });
    });

    it("gives modifiers left out their defaults, and with no input is the default (Resolver 5.1)", () => {
        expect(dark.input).toStrictEqual({ theme: "dark", density: "comfy" });
        expect(light.input).toStrictEqual({ theme: "light", density: "comfy" });
    });

    it("matches modifier and context names case-insensitively (Resolver 5.1)", () => {
        expect(tokens.getPermutation({ Theme: "DARK" })).toBe(dark);
    });

    it("is one of the permutations the read built", () => {
        expect(tokens.permutations).toContain(dark);
    });

    it.for([
        [
            "throws for a modifier the resolver does not declare, saying which",
            () => tokens.getPermutation({ size: "large" }),
            "there is no modifier named `size`",
            { reason: "unknown-modifier", modifier: "size", valid: ["theme", "density"] },
        ],
        [
            "throws for a context that is not a string (Resolver 5.2)",
            () => tokens.getPermutation({ theme: 1 } as unknown as Input),
            "the input for the modifier `theme` must be a string",
            { reason: "not-a-string", modifier: "theme" },
        ],
        [
            "throws for a context the modifier does not declare, saying which",
            () => tokens.getPermutation({ theme: "sepia" }),
            "`sepia` is not a context of the modifier `theme`",
            {
                reason: "unknown-context",
                modifier: "theme",
                context: "sepia",
                valid: ["light", "dark"],
            },
        ],
        [
            "throws when a modifier with no default is left out, naming its contexts (Resolver 5)",
            () => noDefault.getPermutation(),
            "the input doesn't choose a context for the modifier `theme`, which has no default: choose `light` or `dark`",
            { reason: "missing-modifier", modifier: "theme", valid: ["light", "dark"] },
        ],
        [
            "throws for a permutation the read did not build, naming it",
            () => readWith([{ theme: "dark" }]).getPermutation(),
            "`theme: light, density: comfy` was not built by this read",
            { reason: "not-read", input: { theme: "light", density: "comfy" } },
        ],
    ] as const)("%s", ([, run, message, detail]) => {
        const error = thrownBy(PermutationError, run);
        expect(error.message).toBe(message);
        expect(error.detail).toStrictEqual(detail);
    });
});

describe("tokens.getPermutation, completing an input", () => {
    it("gives the first problem: a modifier it names before one it leaves out", () => {
        const error = thrownBy(PermutationError, () => noDefault.getPermutation({ mood: "calm" }));
        expect(error.detail).toMatchObject({ reason: "unknown-modifier" });
    });

    it("takes modifiers in the resolution order, as the read does, not the order written", () => {
        const swapped = readFromMemory(
            {
                files: {
                    "tokens.resolver.json": JSON.stringify({
                        version: "2025.10",
                        modifiers: {
                            size: { contexts: { small: [], large: [] } },
                            theme: { contexts: { light: [], dark: [] } },
                        },
                        resolutionOrder: [
                            { $ref: "#/modifiers/theme" },
                            { $ref: "#/modifiers/size" },
                        ],
                    }),
                },
            },
            { inputs: [{}, { size: "large", theme: "dark" }] },
        );
        expect(swapped.diagnostics[0]).toMatchObject({ detail: { modifier: "theme" } });
        expect(thrownBy(PermutationError, () => swapped.getPermutation()).detail).toMatchObject({
            modifier: "theme",
        });
        expect(
            Object.keys(swapped.getPermutation({ size: "large", theme: "dark" }).input),
        ).toStrictEqual(["theme", "size"]);
    });

    it("checks nothing when the resolver declares no modifiers (Resolver 6.1)", () => {
        expect(single.getPermutation({ theme: "dark" }).input).toStrictEqual({});
        expect(single.getPermutation({ theme: "dark" })).toBe(single.permutations[0]);
    });
});

describe("permutation.isDefault", () => {
    it("is true for the permutation with every modifier at its default, the empty input's (Resolver 4.1.5.3, 6.1)", () => {
        expect(tokens.permutations.filter(({ isDefault }) => isDefault)).toStrictEqual([light]);
        expect(dark.isDefault).toBe(false);
    });

    it("is true for none when a modifier has no default", () => {
        expect(noDefault.permutations.some(({ isDefault }) => isDefault)).toBe(false);
    });

    it("is true for the one permutation of a file read without a resolver", () => {
        expect(single.permutations[0]?.isDefault).toBe(true);
    });

    it("is not written in the plain form", () => {
        expect(JSON.parse(JSON.stringify(light))).not.toHaveProperty("isDefault");
    });
});

describe("tokens.getTokenPaths", () => {
    it("lists every token in any permutation once, in the order the permutations list them", () => {
        expect(tokens.getTokenPaths()).toStrictEqual([
            "px",
            "2",
            "1",
            "space.$root",
            "space.sm",
            "space.inset.lg",
            "spacer.x",
            "glow",
        ]);
    });
});

describe("tokens.getGroupPaths", () => {
    it("lists every group in any permutation once, in the order the permutations list them", () => {
        expect(tokens.getGroupPaths()).toStrictEqual(["", "space", "space.inset", "spacer"]);
    });
});

describe("tokens.has", () => {
    it("says whether a token or group is at a path in any permutation", () => {
        expect(tokens.has("glow")).toBe(true);
        expect(tokens.has("space.inset")).toBe(true);
        expect(tokens.has("space.lg")).toBe(false);
        expect(tokens.has("toString")).toBe(false);
    });
});

describe("toInputLabel", () => {
    it("names each modifier and its context, in the order the input lists them", () => {
        expect(toInputLabel({ density: "compact", theme: "dark" })).toBe(
            "density: compact, theme: dark",
        );
    });

    it("writes a permutation's input as its label, every modifier named", () => {
        const compact = tokens.getPermutation({ density: "compact" });
        expect(toInputLabel(compact.input)).toBe(compact.label);
        expect(compact.label).toBe("theme: light, density: compact");
    });
});

describe("permutation.getToken", () => {
    it("is the token at a path in that permutation", () => {
        expect(valueOf(light.getToken("2"))).toBe(2);
        expect(valueOf(dark.getToken("2"))).toBe(3);
        expect(valueOf(tokens.getPermutation({ density: "compact" }).getToken("space.sm"))).toBe(2);
    });

    it("is the same object the permutation's tokens and its groups' children hold", () => {
        const sm = light.getToken("space.sm");
        expect(light.tokens).toContain(sm);
        expect(light.getGroup("space")?.children).toContain(sm);
    });

    it("is undefined for a path that is not a token in that permutation", () => {
        expect(light.getToken("glow")).toBeUndefined();
        expect(light.getToken("space")).toBeUndefined();
        expect(light.getToken("toString")).toBeUndefined();
        expect(valueOf(dark.getToken("glow"))).toBe(4);
    });
});

describe("permutation.getGroup", () => {
    it("is the group at a path in that permutation", () => {
        expect(light.getGroup("space.inset")?.path).toBe("space.inset");
        expect(dark.getGroup("space")?.type).toBe("dimension");
        expect(light.groups).toContain(light.getGroup("space"));
    });

    it("is undefined for a path that is a token, not a group", () => {
        expect(light.getGroup("space.sm")).toBeUndefined();
        expect(light.getGroup("constructor")).toBeUndefined();
    });
});

describe("group.tokens", () => {
    it("lists a group's tokens and its subgroups' in file order, its $root included", () => {
        expect(paths(light.getGroup("space")?.tokens)).toStrictEqual([
            "space.$root",
            "space.sm",
            "space.inset.lg",
        ]);
    });

    it("leaves out a sibling whose name only starts the same way", () => {
        expect(paths(light.getGroup("space")?.tokens)).not.toContain("spacer.x");
    });

    it("lists the tokens of its own permutation", () => {
        const compact = tokens.getPermutation({ density: "compact" });
        expect(valueOf(compact.getGroup("space")?.tokens[1])).toBe(2);
        expect(compact.getGroup("space")?.tokens[1]).toBe(compact.getToken("space.sm"));
    });
});

describe("token.winningDefinition", () => {
    it("is the place whose value wins, the last it is written (Resolver 6.2)", () => {
        const darkTwo = dark.getToken("2");
        expect(darkTwo?.winningDefinition).toBe(darkTwo?.definitions.at(-1));
        expect(darkTwo?.winningDefinition.source.file).toBe("dark.json");
        expect(light.getToken("2")?.winningDefinition.source.file).toBe("base.json");
    });
});

describe("the plain form", () => {
    it("writes none of the questions, only what was read", () => {
        const written = JSON.parse(JSON.stringify(tokens));
        expect(written).not.toHaveProperty("tokenPaths");
        expect(written.permutations[0]).not.toHaveProperty("token");
        const token = written.permutations[0].tokens.find(
            ({ path }: { path: string }) => path === "space.sm",
        );
        expect(token).not.toHaveProperty("valueFrom");
        expect(token).not.toHaveProperty("parts");
        expect(written.permutations[0].groups[0]).not.toHaveProperty("tokens");
    });
});
