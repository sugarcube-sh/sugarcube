import { type DesignTokens, defineGenerator, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { type FileOp, createSession, create, rename, setValue } from "../src/index.js";
import { at, committed, demo, opsIn, opsOf } from "./helpers.js";

const refused = (kind: string, facts: object) => ({
    refused: { kind, ...facts, reason: expect.any(String) },
});

const one = (tree: object) =>
    readFromMemory({ files: { "tokens.json": `${JSON.stringify(tree, null, 2)}\n` } });

const red = { colorSpace: "srgb", components: [1, 0, 0] };

function changedLines(before: DesignTokens, after: DesignTokens, file: string): number {
    const was = (before.getText(file) ?? "").split("\n");
    const now = (after.getText(file) ?? "").split("\n");
    return now.filter((line, index) => line !== was[index]).length;
}

describe("rename, on the demo", () => {
    it('is refused for the top level, "", which has no name', () => {
        expect(rename(demo, "", "everything")).toEqual({
            refused: { kind: "top-level", reason: expect.any(String) },
        });
    });

    const result = rename(demo, "color.brand", "primary");
    const after = committed(demo, result);

    it("renames the group's key and rewrites the 11 references to the tokens inside it", () => {
        const ops = opsOf(result);
        expect(ops[0]).toEqual({
            kind: "renameKey",
            file: "color.json",
            jsonPath: ["color", "brand"],
            name: "primary",
            was: at(demo, "color.json", ["color", "brand"]),
        });
        const references = ops.slice(1);
        expect(references.every((op) => op.kind === "set")).toBe(true);
        const byFile: Record<string, number> = {};
        for (const op of references) byFile[op.file] = (byFile[op.file] ?? 0) + 1;
        expect(byFile).toEqual({
            "color.json": 4,
            "dark.json": 4,
            "gradient.json": 2,
            "border.json": 1,
        });
        expect(result.ops && result.moves).toEqual([{ from: "color.brand", to: "color.primary" }]);
    });

    it("changes only the renamed key and the references, every other line kept", () => {
        expect(changedLines(demo, after, "color.json")).toBe(5);
        expect(changedLines(demo, after, "dark.json")).toBe(4);
        expect(changedLines(demo, after, "gradient.json")).toBe(2);
        expect(changedLines(demo, after, "border.json")).toBe(1);
    });

    it("reads with no new problems and the same values under the new names", () => {
        const problems = (tokens: DesignTokens) =>
            tokens.diagnostics.map(({ kind }) => kind).sort();
        expect(problems(after)).toEqual(problems(demo));
        for (const step of ["50", "300", "500", "700", "900"]) {
            expect(after.getPermutation().getToken(`color.primary.${step}`)?.resolved).toEqual(
                demo.getPermutation().getToken(`color.brand.${step}`)?.resolved,
            );
        }
        for (const path of ["color.text.brand", "border.focus", "gradient.brand"]) {
            expect(after.getPermutation().getToken(path)?.resolved).toEqual(
                demo.getPermutation().getToken(path)?.resolved,
            );
            expect(after.getPermutation({ mode: "dark" }).getToken(path)?.resolved).toEqual(
                demo.getPermutation({ mode: "dark" }).getToken(path)?.resolved,
            );
        }
        expect(after.getPermutation().getToken("color.brand.500")).toBeUndefined();
    });

    it("renames a single token and only the references to it", () => {
        const ops = opsOf(rename(demo, "color.brand.500", "550"));
        expect(ops.map((op) => [op.kind, op.file])).toEqual([
            ["renameKey", "color.json"],
            ["set", "color.json"],
            ["set", "border.json"],
        ]);
    });
});

describe("rename, refused", () => {
    it("is refused for a name already taken", () => {
        expect(rename(demo, "color.brand", "neutral")).toEqual(
            refused("taken", { path: "color.neutral" }),
        );
    });

    it("is refused for a name the spec forbids, or none", () => {
        expect(rename(demo, "color.brand", "")).toEqual(refused("invalid-name", { name: "" }));
        expect(rename(demo, "color.brand", "brand.new")).toEqual(
            refused("invalid-name", { name: "brand.new", character: "." }),
        );
    });

    it("is refused for a path that is neither a token nor a group", () => {
        expect(rename(demo, "color.nope", "x")).toEqual(
            refused("not-found", { path: "color.nope" }),
        );
    });

    it("is refused for a token a generator makes, and one inherited through $extends", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
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
        );
        expect(rename(generated, "space.1", "one")).toMatchObject({
            refused: { kind: "generated" },
        });

        const extended = one({
            button: {
                $type: "number",
                base: { pad: { $value: 1 } },
                primary: { $extends: "{button.base}" },
            },
        });
        expect(rename(extended, "button.primary.pad", "gap")).toMatchObject({
            refused: { kind: "inherited" },
        });
    });

    it("leaves what generated tokens refer to as their generator writes it, and lists them as broken", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({
                ok: true,
                value: [
                    { name: "a", $value: "{base}" },
                    { name: "b", $value: "{base}" },
                ],
            }),
        });
        const generated = readFromMemory(
            {
                files: {
                    "tokens.json": JSON.stringify({
                        base: { $type: "number", $value: 1 },
                        g: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                    }),
                },
            },
            { generators: [steps] },
        );
        const result = rename(generated, "base", "core");
        expect(opsOf(result).map(({ kind }) => kind)).toEqual(["renameKey"]);
        expect(result.ops && result.broken).toEqual(["g.a", "g.b"]);
    });

    it("changes nothing when the name is the one it has", () => {
        expect(opsOf(rename(demo, "color.brand", "brand"))).toEqual([]);
    });
});

describe("rename, references of every kind", () => {
    it("rewrites a $ref pointer, keeping the steps into the value", () => {
        const tokens = one({
            color: { $type: "color", brand: { $value: red } },
            alpha: { $type: "number", $value: { $ref: "#/color/brand/$value/components/0" } },
        });
        const after = committed(tokens, rename(tokens, "color.brand", "primary"));

        expect(at(after, "tokens.json", ["alpha", "$value"])).toEqual({
            $ref: "#/color/primary/$value/components/0",
        });
        expect(after.getPermutation().getToken("alpha")?.resolved).toBe(1);
    });

    it("rewrites a group's $extends", () => {
        const tokens = one({
            button: {
                $type: "number",
                base: { pad: { $value: 1 } },
                primary: { $extends: "{button.base}" },
            },
        });
        const after = committed(tokens, rename(tokens, "button.base", "core"));

        expect(at(after, "tokens.json", ["button", "primary", "$extends"])).toBe("{button.core}");
        expect(after.getPermutation().getGroup("button.primary")?.extends?.path).toBe(
            "button.core",
        );
        expect(after.diagnostics).toEqual([]);
    });

    it("rewrites the top level's $extends", () => {
        const tokens = one({
            $extends: "{base}",
            base: { $type: "number", pad: { $value: 1 } },
        });
        const after = committed(tokens, rename(tokens, "base", "core"));

        expect(at(after, "tokens.json", ["$extends"])).toBe("{core}");
        expect(after.getPermutation().topLevel.extends?.path).toBe("core");
        expect(after.getPermutation().getToken("pad")?.inherited).toStrictEqual({ from: "core" });
        expect(after.diagnostics).toEqual([]);
    });

    it("rewrites a token's $ref, which is the pointer alone", () => {
        const tokens = one({
            button: {
                $type: "number",
                base: { pad: { $value: 1 } },
                primary: { $ref: "#/button/base/pad/$value" },
            },
        });
        const after = committed(tokens, rename(tokens, "button.base", "core"));

        expect(at(after, "tokens.json", ["button", "primary", "$ref"])).toBe(
            "#/button/core/pad/$value",
        );
        expect(after.getPermutation().getToken("button.primary")?.resolved).toBe(1);
        expect(after.diagnostics).toEqual([]);
    });

    it("rewrites a reference written inside the group it renames", () => {
        const tokens = one({ g: { $type: "number", a: { $value: 1 }, b: { $value: "{g.a}" } } });
        const after = committed(tokens, rename(tokens, "g", "h"));

        expect(at(after, "tokens.json", ["h", "b", "$value"])).toBe("{h.a}");
        expect(after.getPermutation().getToken("h.b")?.resolved).toBe(1);
    });

    it("rewrites a reference in a value that has another mistake", () => {
        const tokens = one({
            red: { $type: "color", $value: red },
            line: { $type: "border", $value: { color: "{red}", width: "wide", style: "solid" } },
        });
        const after = committed(tokens, rename(tokens, "red", "danger"));

        expect(at(after, "tokens.json", ["line", "$value", "color"])).toBe("{danger}");
    });

    it("leaves a description that mentions the token alone", () => {
        const tokens = one({
            red: { $type: "color", $value: red, $description: "Not {red}, the real one." },
            text: { $type: "color", $value: "{red}" },
        });
        const after = committed(tokens, rename(tokens, "red", "danger"));

        expect(at(after, "tokens.json", ["danger", "$description"])).toBe(
            "Not {red}, the real one.",
        );
        expect(at(after, "tokens.json", ["text", "$value"])).toBe("{danger}");
    });

    it("rewrites a reference in tokens written in a resolver, keeping its comments", () => {
        const resolver = `{
  // The design system.
  "version": "2025.10",
  "sets": {
    "base": {
      "sources": [
        { "$ref": "./base.json" },
        { "text": { "$type": "color", "$value": "{red}" } }
      ]
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/base" }]
}
`;
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": resolver,
                "base.json": JSON.stringify({ red: { $type: "color", $value: red } }),
            },
        });
        const after = committed(tokens, rename(tokens, "red", "danger"));

        expect(after.getText("tokens.resolver.json")).toContain("// The design system.");
        expect(after.getText("tokens.resolver.json")).toContain('"$value": "{danger}"');
        expect(after.getPermutation().getToken("text")?.resolved).toEqual(
            tokens.getPermutation().getToken("text")?.resolved,
        );
    });
});

describe("rename, a file several contexts list", () => {
    it("renames its key once", () => {
        const tokens = readFromMemory({
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
        const result = rename(tokens, "gap", "space");

        expect(opsOf(result).map(({ file }) => file)).toStrictEqual(["base.json", "night.json"]);
        expect(
            committed(tokens, result).getPermutation({ mode: "dim" }).getToken("space")?.resolved,
        ).toBe(2);
    });
});

describe("rename, in a session", () => {
    it("keeps a token's id, lists one rename per token, and none for what points at them", () => {
        const session = createSession(demo);
        const id = session.idOf("color.brand.500");
        session.do(rename(session.tokens, "color.brand", "primary"));

        expect(session.pathOf(id ?? "")).toBe("color.primary.500");
        const kinds = new Set(session.changes().map(({ kind }) => kind));
        expect(kinds).toEqual(new Set(["group-renamed", "renamed"]));
    });

    it("gives a token made at the vacated path an id of its own", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.brand", "primary"));
        session.do(create(session.tokens, "color.brand", { $value: red }));

        expect(session.idOf("color.brand")).toMatch(/^new:/);
        expect(session.pathOf("color.brand")).toBe("color.primary");
    });

    it("keeps ids through renames put back after a reload", () => {
        const before = createSession(demo);
        before.do(rename(before.tokens, "radius.md", "medium"));
        before.do(rename(before.tokens, "radius.medium", "mid"));

        const session = createSession(demo);
        expect(session.restore(before.unsaved)).toEqual([]);
        expect(session.pathOf("radius.md")).toBe("radius.mid");
    });

    it("saves a rename and other edits that apply to the opened files to the same design tokens", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        session.do(rename(session.tokens, "color.brand", "primary"));
        session.do(setValue(session.tokens, "color.primary.600", red));
        const ops: readonly FileOp[] = opsIn(session.unsaved);

        expect(
            committed(demo, {
                ops,
                alsoAffects: demo.permutations.select(() => false),
                moves: [],
            }).toMemory().files,
        ).toEqual(session.tokens.toMemory().files);
    });
});
