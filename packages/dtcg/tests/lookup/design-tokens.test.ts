import { describe, expect, it } from "vitest";
import {
    type DesignTokens,
    type Input,
    PermutationError,
    toInputLabel,
    readFromMemory,
} from "../../src/index.js";

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
    return readFromMemory({ files, entryFile: "tokens.resolver.json" }, inputs && { inputs });
}

const tokens = readWith();
const light = tokens.getPermutation();
const dark = tokens.getPermutation({ theme: "dark" });
const paths = (items: readonly { path: string }[] | undefined) => items?.map(({ path }) => path);
const valueOf = (found: ReturnType<typeof light.getToken>) =>
    found?.type === "dimension" ? found.resolved?.value : undefined;

const noDefault = readFromMemory({
    files: {
        ...files,
        "tokens.resolver.json": JSON.stringify({
            ...resolver,
            modifiers: { theme: { contexts: resolver.modifiers.theme.contexts } },
            resolutionOrder: resolver.resolutionOrder.slice(0, 2),
        }),
    },
    entryFile: "tokens.resolver.json",
});

function thrown(run: () => unknown): PermutationError {
    try {
        run();
    } catch (error) {
        if (error instanceof PermutationError) return error;
        throw error;
    }
    throw new Error("nothing was thrown");
}

describe("tokens.permutation", () => {
    it("is the permutation for a full input", () => {
        expect(tokens.getPermutation({ theme: "dark", density: "compact" }).input).toStrictEqual({
            theme: "dark",
            density: "compact",
        });
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

    it("is the one permutation of a file read without a resolver", () => {
        const single = readFromMemory({ files: { "tokens.json": files["base.json"] } });
        expect(single.getPermutation()).toBe(single.permutations[0]);
    });

    it("throws for a modifier the resolver does not declare, saying which", () => {
        const error = thrown(() => tokens.getPermutation({ size: "large" }));
        expect(error.message).toBe("there is no modifier named `size`");
        expect(error.detail).toStrictEqual({
            reason: "unknown-modifier",
            modifier: "size",
            valid: ["theme", "density"],
        });
    });

    it("throws for a context that is not a string (Resolver 5.2)", () => {
        const error = thrown(() => tokens.getPermutation({ theme: 1 } as unknown as Input));
        expect(error.message).toBe("the input for the modifier `theme` must be a string");
        expect(error.detail).toStrictEqual({ reason: "not-a-string", modifier: "theme" });
    });

    it("throws for a context the modifier does not declare, saying which", () => {
        const error = thrown(() => tokens.getPermutation({ theme: "sepia" }));
        expect(error.message).toBe("`sepia` is not a context of the modifier `theme`");
        expect(error.detail).toStrictEqual({
            reason: "unknown-context",
            modifier: "theme",
            context: "sepia",
            valid: ["light", "dark"],
        });
    });

    it("throws when a modifier with no default is left out, naming its contexts (Resolver 5)", () => {
        const error = thrown(() => noDefault.getPermutation());
        expect(error.message).toBe(
            "the input doesn't choose a context for the modifier `theme`, which has no default: choose `light` or `dark`",
        );
        expect(error.detail).toStrictEqual({
            reason: "missing-modifier",
            modifier: "theme",
            valid: ["light", "dark"],
        });
        expect(noDefault.getPermutation({ theme: "dark" }).input).toStrictEqual({ theme: "dark" });
    });

    it("throws for a permutation the read did not build, naming it", () => {
        const error = thrown(() => readWith([{ theme: "dark" }]).getPermutation());
        expect(error.message).toBe("`theme: light, density: comfy` was not built by this read");
        expect(error.detail).toStrictEqual({
            reason: "not-read",
            input: { theme: "light", density: "comfy" },
        });
    });
});

function completed(from: DesignTokens, input: Input) {
    try {
        return { ok: true as const, input: from.getPermutation(input).input };
    } catch (error) {
        if (error instanceof PermutationError) return { ok: false as const, ...error.detail };
        throw error;
    }
}

describe("tokens.permutation, completing an input", () => {
    it("gives every modifier, defaults filled in and names as the resolver writes them", () => {
        expect(completed(tokens, { Theme: "DARK" })).toStrictEqual({
            ok: true,
            input: { theme: "dark", density: "comfy" },
        });
    });

    it("says which modifier or context the resolver does not declare", () => {
        expect(completed(tokens, { mood: "calm" })).toStrictEqual({
            ok: false,
            reason: "unknown-modifier",
            modifier: "mood",
            valid: ["theme", "density"],
        });
        expect(completed(tokens, { theme: "sepia" })).toStrictEqual({
            ok: false,
            reason: "unknown-context",
            modifier: "theme",
            context: "sepia",
            valid: ["light", "dark"],
        });
    });

    it("says which modifier with no default was left out, and its contexts", () => {
        expect(completed(noDefault, {})).toStrictEqual({
            ok: false,
            reason: "missing-modifier",
            modifier: "theme",
            valid: ["light", "dark"],
        });
    });

    it("says which context is not a string (Resolver 5.2)", () => {
        expect(completed(tokens, { theme: true } as unknown as Input)).toStrictEqual({
            ok: false,
            reason: "not-a-string",
            modifier: "theme",
        });
    });

    it("gives the first problem: a modifier it names before one it leaves out", () => {
        expect(completed(noDefault, { mood: "calm" })).toMatchObject({
            reason: "unknown-modifier",
        });
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
        expect(completed(swapped, {})).toMatchObject({ modifier: "theme" });
        const complete = completed(swapped, { size: "large", theme: "dark" });
        expect(complete.ok && Object.keys(complete.input)).toStrictEqual(
            Object.keys(swapped.getPermutation({ size: "large", theme: "dark" }).input),
        );
    });

    it("checks nothing when the resolver declares no modifiers (Resolver 6.1)", () => {
        const single = readFromMemory({ files: { "tokens.json": files["base.json"] } });
        expect(completed(single, { theme: "dark" })).toStrictEqual({ ok: true, input: {} });
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
        const single = readFromMemory({ files: { "tokens.json": files["base.json"] } });
        expect(single.permutations[0]?.isDefault).toBe(true);
    });

    it("is not written in the plain form", () => {
        expect(JSON.parse(JSON.stringify(light))).not.toHaveProperty("isDefault");
    });
});

describe("tokens.tokenPaths", () => {
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

describe("tokens.groupPaths", () => {
    it("lists every group in any permutation once, in the order the permutations list them", () => {
        expect(tokens.getGroupPaths()).toStrictEqual(["space", "space.inset", "spacer"]);
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

describe("the modifiers that take part", () => {
    it("are the resolver's, with their contexts and default", () => {
        expect(tokens.resolver?.modifiers.map(({ name }) => name)).toStrictEqual([
            "theme",
            "density",
        ]);
        expect(tokens.resolver?.modifiers[0]).toMatchObject({ name: "theme", default: "light" });
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

describe("permutation.token", () => {
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

describe("permutation.group", () => {
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
