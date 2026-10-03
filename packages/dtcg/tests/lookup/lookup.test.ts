import { describe, expect, it } from "vitest";
import {
    type Document,
    byToken,
    defaultPermutation,
    errors,
    group,
    permutation,
    readFromMemory,
    token,
    tokensIn,
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

function readWith(inputs?: Document["permutations"][number]["input"][]): Document {
    return readFromMemory({ files, entry: "tokens.resolver.json" }, inputs && { inputs });
}

const doc = readWith();
const paths = (tokens: readonly { path: string }[] | undefined) => tokens?.map(({ path }) => path);
const valueOf = (found: ReturnType<typeof token>) =>
    found?.type === "dimension" ? found.resolved?.value : undefined;

describe("permutation", () => {
    it("finds the permutation for a full input", () => {
        expect(permutation(doc, { theme: "dark", density: "compact" })?.input).toStrictEqual({
            theme: "dark",
            density: "compact",
        });
    });

    it("gives modifiers left out their defaults (Resolver 5.1)", () => {
        expect(permutation(doc, { theme: "dark" })?.input).toStrictEqual({
            theme: "dark",
            density: "comfy",
        });
        expect(permutation(doc)?.input).toStrictEqual({ theme: "light", density: "comfy" });
    });

    it("matches modifier and context names case-insensitively (Resolver 5.1)", () => {
        expect(permutation(doc, { Theme: "DARK" })?.input).toStrictEqual({
            theme: "dark",
            density: "comfy",
        });
    });

    it("finds nothing for a modifier or context the resolver does not declare", () => {
        expect(permutation(doc, { mood: "calm" })).toBeUndefined();
        expect(permutation(doc, { theme: "sepia" })).toBeUndefined();
    });

    it("finds nothing for an input the read did not build", () => {
        const onlyDark = readWith([{ theme: "dark" }]);
        expect(permutation(onlyDark, { theme: "light" })).toBeUndefined();
    });

    it("finds nothing when a modifier with no default is left out", () => {
        const noDefault = readFromMemory({
            files: {
                ...files,
                "tokens.resolver.json": JSON.stringify({
                    ...resolver,
                    modifiers: { theme: { contexts: resolver.modifiers.theme.contexts } },
                    resolutionOrder: resolver.resolutionOrder.slice(0, 2),
                }),
            },
            entry: "tokens.resolver.json",
        });
        expect(permutation(noDefault)).toBeUndefined();
        expect(permutation(noDefault, { theme: "dark" })?.input).toStrictEqual({ theme: "dark" });
    });
});

describe("defaultPermutation", () => {
    it("is the permutation with every modifier at its default", () => {
        expect(defaultPermutation(doc)?.input).toStrictEqual({ theme: "light", density: "comfy" });
    });

    it("is undefined when the read did not build it", () => {
        expect(defaultPermutation(readWith([{ theme: "dark" }]))).toBeUndefined();
    });

    it("is the one permutation of a file read without a resolver", () => {
        const single = readFromMemory({ files: { "tokens.json": files["base.json"] } });
        expect(defaultPermutation(single)).toBe(single.permutations[0]);
    });
});

describe("token", () => {
    it("finds a token in the default permutation when no input is given", () => {
        expect(valueOf(token(doc, "2"))).toBe(2);
    });

    it("finds a token in the permutation an input names", () => {
        expect(valueOf(token(doc, "2", { theme: "dark" }))).toBe(3);
        expect(valueOf(token(doc, "space.sm", { density: "compact" }))).toBe(2);
    });

    it("uses the first permutation when there is no default one", () => {
        expect(valueOf(token(readWith([{ theme: "dark" }]), "2"))).toBe(3);
    });

    it("finds nothing for a path that is not a token in that permutation", () => {
        expect(token(doc, "glow")).toBeUndefined();
        expect(token(doc, "space")).toBeUndefined();
        expect(token(doc, "toString")).toBeUndefined();
        expect(token(doc, "2", { theme: "sepia" })).toBeUndefined();
    });

    it("finds a token in a permutation already in hand", () => {
        const dark = permutation(doc, { theme: "dark" });
        if (!dark) throw new Error("no dark permutation");
        expect(valueOf(token(dark, "2"))).toBe(3);
        expect(valueOf(token(dark, "glow"))).toBe(4);
        expect(token(dark, "toString")).toBeUndefined();
    });
});

describe("group", () => {
    it("finds a group by path, in the permutation an input names", () => {
        expect(group(doc, "space.inset")?.path).toBe("space.inset");
        expect(group(doc, "space", { theme: "dark" })?.type).toBe("dimension");
    });

    it("finds nothing for a path that is a token, not a group", () => {
        expect(group(doc, "space.sm")).toBeUndefined();
        expect(group(doc, "constructor")).toBeUndefined();
    });

    it("finds a group in a permutation already in hand", () => {
        const compact = permutation(doc, { density: "compact" });
        if (!compact) throw new Error("no compact permutation");
        expect(group(compact, "space")?.type).toBe("dimension");
        expect(group(compact, "space.sm")).toBeUndefined();
    });
});

describe("tokensIn", () => {
    it("lists a group's tokens and its subgroups' in file order, its $root included", () => {
        expect(paths(tokensIn(doc, "space"))).toStrictEqual([
            "space.$root",
            "space.sm",
            "space.inset.lg",
        ]);
    });

    it("leaves out a sibling whose name only starts the same way", () => {
        expect(paths(tokensIn(doc, "space"))).not.toContain("spacer.x");
    });

    it("lists every token for the top level, whole-number names where the file writes them", () => {
        expect(paths(tokensIn(doc, ""))).toStrictEqual([
            "px",
            "2",
            "1",
            "space.$root",
            "space.sm",
            "space.inset.lg",
            "spacer.x",
        ]);
    });

    it("lists the tokens of the permutation an input names", () => {
        expect(paths(tokensIn(doc, "", { theme: "dark" }))).toContain("glow");
    });

    it("is empty for a path that is not a group, or an input that matches nothing", () => {
        expect(tokensIn(doc, "space.sm")).toStrictEqual([]);
        expect(tokensIn(doc, "space", { theme: "sepia" })).toStrictEqual([]);
    });

    it("lists the tokens of a permutation already in hand", () => {
        const dark = permutation(doc, { theme: "dark" });
        if (!dark) throw new Error("no dark permutation");
        expect(paths(tokensIn(dark, ""))).toContain("glow");
        expect(paths(tokensIn(dark, "space"))).toStrictEqual([
            "space.$root",
            "space.sm",
            "space.inset.lg",
        ]);
    });
});

describe("byToken", () => {
    const twoThemes = readWith([{ theme: "light" }, { theme: "dark" }]);

    it("lists every token once, in file order, whole-number names included", () => {
        expect(paths(byToken(twoThemes))).toStrictEqual([
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

    it("places a token the default permutation lacks after the ones it has", () => {
        const darkFirst = readWith([{ theme: "dark" }, { theme: "light" }]);
        expect(paths(byToken(darkFirst))?.at(-1)).toBe("glow");
    });

    it("holds each token as it is in every permutation, keyed by label", () => {
        const two = byToken(twoThemes).find(({ path }) => path === "2");
        expect(two?.type).toBe("dimension");
        expect(Object.keys(two?.permutations ?? {})).toStrictEqual(["default", "dark"]);
        expect(valueOf(two?.permutations.dark)).toBe(3);
        expect(valueOf(two?.default)).toBe(2);
    });

    it("has no default for a token the default permutation lacks", () => {
        const glow = byToken(twoThemes).find(({ path }) => path === "glow");
        expect(Object.keys(glow?.permutations ?? {})).toStrictEqual(["dark"]);
        expect(glow?.default).toBeUndefined();
    });

    it("is computed once per Document", () => {
        expect(byToken(twoThemes)).toBe(byToken(twoThemes));
    });

    it("cannot be sorted in place, since every caller shares it", () => {
        // @ts-expect-error
        const sortInPlace = () => byToken(twoThemes).sort();
        expect(sortInPlace).toBeTypeOf("function");
    });
});

describe("errors", () => {
    it("keeps the errors and leaves out warnings, in the order they were found", () => {
        const checked = readFromMemory({
            files: {
                "tokens.json": JSON.stringify({
                    " spaced": { $type: "number", $value: 1 },
                    "first": { $type: "number", $value: "{missing.one}" },
                    "second": { $type: "number", $value: "{missing.two}" },
                }),
            },
        });
        expect(checked.diagnostics.map(({ kind }) => kind)).toContain("whitespace-in-name");
        expect(errors(checked).map(({ kind, path }) => [kind, path])).toStrictEqual([
            ["missing-reference", "first"],
            ["missing-reference", "second"],
        ]);
    });

    it("is empty when nothing stops the design system from being used", () => {
        expect(errors(readFromMemory({ files: { "tokens.json": "{}" } }))).toStrictEqual([]);
    });
});
