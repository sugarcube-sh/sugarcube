import { describe, expect, it } from "vitest";
import { type DesignTokens, defineGenerator, readFromMemory, tokenPath } from "../../src/index.js";

const color = (red: number) => ({ $value: { colorSpace: "srgb", components: [red, 0, 0] } });

function oneFile(json: unknown): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } });
}

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("links", () => {
    const tokens = oneFile({
        color: { $type: "color", bg: color(1), brand: { "500": color(0.5), "$root": color(0.6) } },
        gap: { $type: "number", $value: 2 },
    });
    const base = tokens.getPermutation();

    it("point down and across only: a token has no group or permutation, a group no group", () => {
        expect(base.getToken("color.bg")).not.toHaveProperty("group");
        expect(base.getToken("color.bg")).not.toHaveProperty("permutation");
        expect(base.getGroup("color.brand")).not.toHaveProperty("group");
    });

    it("reach a token from the group its path names", () => {
        for (const path of ["color.bg", "color.brand.500", "color.brand.$root"]) {
            expect(base.getGroup(tokenPath.parent(path) ?? "")?.children).toContain(
                base.getToken(path),
            );
        }
    });

    it("reach a token $extends brings from the group that takes it", () => {
        const extending = oneFile({
            button: { $type: "number", pad: { $value: 1 } },
            primary: { $extends: "{button}" },
        });
        const extended = extending.getPermutation();
        expect(extended.getGroup("primary")?.children).toContain(extended.getToken("primary.pad"));
    });

    it("reach a token a generator adds from the group it adds it to", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            messages: {},
            generate: () => ({ ok: true, value: [{ name: "1", $value: 1 }] }),
        });
        const generated = readFromMemory(
            {
                files: {
                    "tokens.json": JSON.stringify({
                        space: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                    }),
                },
            },
            { generators: [steps] },
        ).getPermutation();
        expect(generated.getGroup("space")?.children).toContain(generated.getToken("space.1"));
    });

    it("reach each permutation's own tokens from its own groups", () => {
        const themed = readFromMemory({
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
                "base.json": JSON.stringify({ color: { $type: "color", bg: color(1) } }),
                "dark.json": JSON.stringify({ color: { bg: color(0) } }),
            },
        });
        const dark = themed.getPermutation({ mode: "dark" });
        const light = themed.getPermutation({ mode: "light" });
        expect(dark.getGroup("color")?.children).toContain(dark.getToken("color.bg"));
        expect(light.getGroup("color")?.children).not.toContain(dark.getToken("color.bg"));
    });
});

describe("a group's root token", () => {
    const tokens = oneFile({
        color: { $type: "color", brand: { "500": color(0.5), "$root": color(0.6) }, bg: color(1) },
    });

    it("is the token named $root in it (Format 6.2)", () => {
        expect(tokens.getPermutation().getGroup("color.brand")?.rootToken).toBe(
            tokens.getPermutation().getToken("color.brand.$root"),
        );
    });

    it("is absent when the group has none", () => {
        expect(tokens.getPermutation().getGroup("color")?.rootToken).toBeUndefined();
    });
});

describe("kind", () => {
    const tokens = oneFile({ color: { $type: "color", bg: color(1) } });

    it("says a token is a token and a group a group (Format 6.1)", () => {
        expect(tokens.getPermutation().getToken("color.bg")?.kind).toBe("token");
        expect(tokens.getPermutation().getGroup("color")?.kind).toBe("group");
    });

    it("tells a group's children apart", () => {
        const nested = oneFile({ color: { $type: "color", bg: color(1), brand: {} } });
        const kinds = nested
            .getPermutation()
            .getGroup("color")
            ?.children.map(({ kind }) => kind);
        expect(kinds).toStrictEqual(["token", "group"]);
    });
});

describe("the plain form", () => {
    const tokens = oneFile({
        color: { $type: "color", bg: color(1), brand: { "500": color(0.5), "$root": color(0.6) } },
        gap: { $type: "number", $value: 2 },
    });
    const base = tokens.getPermutation();

    it("is what JSON.stringify writes, though the links go in circles", () => {
        expect(() => JSON.stringify(tokens)).not.toThrow();
    });

    it("writes a token without its kind", () => {
        const bg = tokens.getPermutation().getToken("color.bg");
        const written = plain(bg);
        expect(written).not.toHaveProperty("kind");
        expect(written).toStrictEqual(plain({ ...bg }));
    });

    it("writes a group's children as their paths, without its root token or kind", () => {
        const written = plain(tokens.getPermutation().getGroup("color.brand"));
        expect(written.children).toStrictEqual(["color.brand.500", "color.brand.$root"]);
        expect(written).not.toHaveProperty("rootToken");
        expect(written).not.toHaveProperty("kind");
    });

    it("writes the top level's children on the permutation, as their paths", () => {
        const written = plain(base);
        expect(written.children).toStrictEqual(["color", "gap"]);
        expect(written.topLevel).not.toHaveProperty("children");
    });

    it("writes every permutation's tokens and groups the same way", () => {
        const written = plain(tokens);
        expect(written.permutations[0].tokens[0]).toStrictEqual(
            plain(tokens.getPermutation().getToken("color.bg")),
        );
        expect(written.permutations[0].groups[0].children).toStrictEqual([
            "color.bg",
            "color.brand",
        ]);
    });
});
