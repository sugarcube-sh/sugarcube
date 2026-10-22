import { defineGenerator } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { deprecate, setDescription } from "../src/index.js";
import { at, committed, demo, opened, opsOf, plainly, resolver } from "./helpers.js";

describe("deprecate", () => {
    it("marks a token in every file that writes it, with the message", () => {
        expect(opsOf(deprecate(demo, "color.text.default", "Use color.text.body."))).toEqual([
            {
                kind: "add",
                file: "color.json",
                jsonPath: ["color", "text", "default", "$deprecated"],
                value: "Use color.text.body.",
            },
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["color", "text", "default", "$deprecated"],
                value: "Use color.text.body.",
            },
        ]);
    });

    it("reads back as deprecated, in every context", () => {
        const after = committed(demo, deprecate(demo, "color.text.default", true));

        for (const perm of after.permutations) {
            expect(perm.token("color.text.default")?.deprecated).toBe(true);
        }
    });

    it("changes the message where one is written", () => {
        const marked = committed(demo, deprecate(demo, "color.brand.500", "Old."));

        expect(opsOf(deprecate(marked, "color.brand.500", "New."))).toEqual([
            {
                kind: "set",
                file: "color.json",
                jsonPath: ["color", "brand", "500", "$deprecated"],
                value: "New.",
                was: "Old.",
            },
        ]);
    });

    it("removes the mark with null, and does nothing when there is none", () => {
        const marked = committed(demo, deprecate(demo, "color.brand.500", "Old."));
        const after = committed(marked, deprecate(marked, "color.brand.500", null));

        expect(after.permutation().token("color.brand.500")?.deprecated).toBeUndefined();
        expect(opsOf(deprecate(demo, "color.brand.600", null))).toEqual([]);
    });

    it("marks a group where the group writes it", () => {
        const after = committed(demo, deprecate(demo, "color.brand", "Use color.accent."));

        expect(at(after, "color.json", ["color", "brand", "$deprecated"])).toBe(
            "Use color.accent.",
        );
        expect(after.permutation().token("color.brand.500")?.deprecated).toBe("Use color.accent.");
    });

    it("changes a group's mark in the file that writes it, when the group is in several", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }, { $ref: "./more.json" }]),
            "base.json": '{ "color": { "$type": "color", "a": { "$value": "#ffffff" } } }',
            "more.json": '{ "color": { "$deprecated": "Old.", "b": { "$value": "#000000" } } }',
        };

        expect(plainly(deprecate(opened(files), "color", "New."))).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "more.json",
                    jsonPath: ["color", "$deprecated"],
                    value: "New.",
                    was: "Old.",
                },
            ],
            alsoAffects: [],
            moved: [],
        });
    });

    it("says a token is not deprecated, over its group, with false", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                old: { $type: "number", $deprecated: true, kept: { $value: 1 } },
            }),
        };
        const tokens = opened(files);
        const after = committed(tokens, deprecate(tokens, "old.kept", false));

        expect(after.permutation().token("old.kept")?.deprecated).toBe(false);
    });

    it("is refused for a path that is neither a token nor a group", () => {
        expect(deprecate(demo, "color.nope", true).refused?.kind).toBe("not-found");
    });

    it("is refused for a token a generator makes", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({
                ok: true,
                value: [{ name: "1", $value: { value: 1, unit: "rem" } }],
            }),
        });
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./space.json" }]),
            "space.json": JSON.stringify({
                space: { $type: "dimension", $extensions: { "com.example": { steps: 1 } } },
            }),
        };

        expect(
            deprecate(opened(files, { generators: [steps] }), "space.1", true).refused?.kind,
        ).toBe("generated");
    });
});

describe("a group that extends another", () => {
    const files = {
        "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
        "base.json": JSON.stringify({
            button: {
                $type: "color",
                $description: "The base for every button.",
                $deprecated: "Use action.",
                icon: { size: { $type: "number", $value: 1 } },
                bg: { $value: "#ffffff" },
            },
            primary: { $extends: "{button}", fg: { $value: "#000000" } },
        }),
    };
    const tokens = opened(files);

    it("is given a description of its own over the one it takes", () => {
        const after = committed(tokens, setDescription(tokens, "primary", "The main action."));

        expect(at(after, "base.json", ["primary", "$description"])).toBe("The main action.");
        expect(after.permutation().group("primary")?.description).toBe("The main action.");
        expect(after.permutation().group("button")?.description).toBe("The base for every button.");
    });

    it("is given a deprecation of its own over the one it takes", () => {
        const after = committed(tokens, deprecate(tokens, "primary", false));

        expect(at(after, "base.json", ["primary", "$deprecated"])).toBe(false);
        expect(after.permutation().group("primary")?.deprecated).toBe(false);
        expect(after.permutation().group("button")?.deprecated).toBe("Use action.");
    });

    it("can't be changed where it is there only because of $extends", () => {
        expect(deprecate(tokens, "primary.icon", true).refused).toMatchObject({
            kind: "inherited",
            path: "primary.icon",
            from: "button",
        });
    });
});
