import { defineGenerator } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { setExtension } from "../src/index.js";
import { at, committed, demo, opened, opsOf, plainly, resolver } from "./helpers.js";

const rem = (value: number) => ({ value, unit: "rem" });
const gutter = ["size", "fluid", "gutter"];
const step = ["size", "step"];

describe("setExtension on a token", () => {
    it("changes one setting where the token is written, and nothing else in the extension", () => {
        const result = setExtension(
            demo,
            "size.fluid.gutter",
            ["com.example", "fluid", "min"],
            rem(1.5),
        );

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "size.json",
                jsonPath: [...gutter, "$extensions", "com.example", "fluid", "min"],
                value: rem(1.5),
                was: rem(1),
            },
        ]);
        expect(at(committed(demo, result), "size.json", [...gutter, "$extensions"])).toEqual({
            "com.example": { fluid: { min: rem(1.5), max: rem(2) } },
        });
    });

    it("writes at a place it is given", () => {
        const [place] = demo.writtenAt("size.fluid.gutter");
        if (!place) throw new Error("the demo writes size.fluid.gutter");
        const path = ["com.example", "fluid", "min"] as const;

        expect(setExtension(demo, "size.fluid.gutter", path, rem(1.5), { at: place.span })).toEqual(
            setExtension(demo, "size.fluid.gutter", path, rem(1.5)),
        );
    });

    it("adds a setting the file doesn't write, making $extensions and the key when missing", () => {
        const note = setExtension(demo, "size.fluid.gutter", ["com.example", "note"], "hand-made");
        const fresh = setExtension(demo, "radius.md", ["org.other", "kept"], true);

        expect(opsOf(note)).toEqual([
            {
                kind: "add",
                file: "size.json",
                jsonPath: [...gutter, "$extensions", "com.example", "note"],
                value: "hand-made",
            },
        ]);
        expect(at(committed(demo, fresh), "radius.json", ["radius", "md", "$extensions"])).toEqual({
            "org.other": { kept: true },
        });
    });

    it("removes a setting for null, and changes nothing when it isn't there", () => {
        const removed = setExtension(
            demo,
            "size.fluid.gutter",
            ["com.example", "fluid", "min"],
            null,
        );

        expect(opsOf(removed)).toEqual([
            {
                kind: "remove",
                file: "size.json",
                jsonPath: [...gutter, "$extensions", "com.example", "fluid", "min"],
                was: rem(1),
            },
        ]);
        expect(opsOf(setExtension(demo, "size.fluid.gutter", ["org.other"], null))).toEqual([]);
    });

    it("gives a context no override of its own just to remove a setting it doesn't have", () => {
        const result = setExtension(demo, "size.fluid.gutter", ["org.other", "kept"], null, {
            input: { mode: "dark" },
        });

        expect(opsOf(result)).toEqual([]);
    });

    it("gives a context its own token, the token's own properties with the setting changed", () => {
        const result = setExtension(
            demo,
            "size.fluid.gutter",
            ["com.example", "fluid", "min"],
            rem(1.5),
            {
                input: { mode: "dark" },
            },
        );

        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "add",
                    file: "dark.json",
                    jsonPath: gutter,
                    value: {
                        $value: rem(2),
                        $extensions: { "com.example": { fluid: { min: rem(1.5), max: rem(2) } } },
                    },
                },
            ],
            alsoAffects: [],
            moved: [],
        });
    });

    it("refuses a token a generator makes, and a path that is nothing", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({ ok: true, value: [{ name: "1", $value: 1 }] }),
        });
        const generated = opened(
            {
                "tokens.resolver.json": resolver([{ $ref: "tokens.json" }]),
                "tokens.json": JSON.stringify({
                    space: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                }),
            },
            { generators: [steps] },
        );

        expect(setExtension(generated, "space.1", ["org.other"], 1).refused?.kind).toBe(
            "generated",
        );
        expect(setExtension(demo, "size.nothing", ["org.other"], 1).refused?.kind).toBe(
            "not-found",
        );
    });
});

describe("setExtension on a group", () => {
    it("changes one setting where the group writes the extension, keeping its neighbours", () => {
        const result = setExtension(
            demo,
            "size.step",
            ["com.example", "scale", "ratio", "max"],
            1.333,
        );

        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "size.json",
                    jsonPath: [...step, "$extensions", "com.example", "scale", "ratio", "max"],
                    value: 1.333,
                    was: 1.25,
                },
            ],
            alsoAffects: [{ mode: "light" }, { mode: "dark" }],
            moved: [],
        });
        const after = at(committed(demo, result), "size.json", [
            ...step,
            "$extensions",
            "com.example",
        ]);
        expect(after).toMatchObject({
            measures: "font-size",
            scale: { ratio: { min: 1.2, max: 1.333 } },
        });
    });

    const twoFiles = {
        "tokens.resolver.json": resolver([{ $ref: "a.json" }, { $ref: "b.json" }], {
            light: [],
            dark: [{ $ref: "dark.json" }],
            dim: [],
        }),
        "a.json": JSON.stringify({
            space: {
                $type: "number",
                $extensions: { "com.example": { steps: 1 }, "org.other": { kept: true } },
            },
            inset: { $extends: "{space}" },
            solo: { $type: "number", one: { $value: 1 } },
        }),
        "b.json": JSON.stringify({
            space: { $extensions: { "com.example": { steps: 2, from: "b" } } },
            solo: { two: { $value: 2 } },
        }),
        "dark.json": JSON.stringify({ space: { $extensions: { "org.other": { kept: false } } } }),
    };
    const spread = opened(twoFiles);

    it("writes in the file whose extension is used, when several write it", () => {
        expect(opsOf(setExtension(spread, "space", ["com.example", "steps"], 3))).toEqual([
            {
                kind: "set",
                file: "b.json",
                jsonPath: ["space", "$extensions", "com.example", "steps"],
                value: 3,
                was: 2,
            },
        ]);
    });

    it("asks which file when no file writes the extension and several write the group", () => {
        const result = setExtension(spread, "solo", ["com.example", "steps"], 3);

        expect(result.question?.files).toEqual(["a.json", "b.json"]);
        expect(opsOf(result.question?.answer("b.json") ?? result)).toEqual([
            {
                kind: "add",
                file: "b.json",
                jsonPath: ["solo", "$extensions", "com.example", "steps"],
                value: 3,
            },
        ]);
    });

    it("gives a group its own copy of an extension it takes from the group it extends, whole, with the setting changed", () => {
        expect(opsOf(setExtension(spread, "inset", ["com.example", "steps"], 3))).toEqual([
            {
                kind: "add",
                file: "a.json",
                jsonPath: ["inset", "$extensions", "com.example"],
                value: { steps: 3, from: "b" },
            },
        ]);
    });

    it("keeps the group it extends as it was, and every other setting the group takes", () => {
        const after = committed(spread, setExtension(spread, "inset", ["com.example", "steps"], 3));

        expect(after.permutation().group("inset")?.extensions).toEqual({
            "com.example": { steps: 3, from: "b" },
            "org.other": { kept: true },
        });
        expect(after.permutation().group("space")?.extensions?.["com.example"]).toEqual({
            steps: 2,
            from: "b",
        });
    });

    it("refuses a shared change when only a context's file writes the extension the group takes", () => {
        const darkOnly = opened({
            "tokens.resolver.json": resolver([{ $ref: "a.json" }], {
                light: [],
                dark: [{ $ref: "dark.json" }],
            }),
            "a.json": JSON.stringify({
                space: { $type: "number" },
                inset: { $extends: "{space}" },
            }),
            "dark.json": JSON.stringify({ space: { $extensions: { "com.x": { a: 1, b: 2 } } } }),
        });

        expect(setExtension(darkOnly, "inset", ["com.x", "a"], 5).refused?.kind).toBe(
            "no-shared-value",
        );
    });

    it("refuses a shared change when a context gives the extension the group takes a value of its own", () => {
        const themed = opened({
            "tokens.resolver.json": resolver([{ $ref: "a.json" }], {
                light: [],
                dark: [{ $ref: "dark.json" }],
            }),
            "a.json": JSON.stringify({
                space: { $type: "number", $extensions: { "com.x": { a: 1, b: 2 } } },
                inset: { $extends: "{space}" },
            }),
            "dark.json": JSON.stringify({ space: { $extensions: { "com.x": { a: 9, b: 9 } } } }),
        });

        expect(setExtension(themed, "inset", ["com.x", "a"], 5).refused?.kind).toBe(
            "no-shared-value",
        );
    });

    it("writes nothing for a setting set to what the group already takes", () => {
        expect(opsOf(setExtension(spread, "inset", ["com.example", "steps"], 2))).toEqual([]);
    });

    it("gives a context its own copy of an extension the group takes from the group it extends", () => {
        const dark = { input: { mode: "dark" } };

        expect(opsOf(setExtension(spread, "inset", ["com.example", "steps"], 3, dark))).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["inset", "$extensions", "com.example"],
                value: { steps: 3, from: "b" },
            },
        ]);
    });

    it("refuses a shared change when only a context's file writes the extension", () => {
        const darkOnly = opened({
            ...twoFiles,
            "a.json": JSON.stringify({ space: { $type: "number" } }),
            "b.json": "{}",
        });

        expect(setExtension(darkOnly, "space", ["org.other", "kept"], true).refused?.kind).toBe(
            "no-shared-value",
        );
    });

    it("gives a context the extension it uses, whole, with the setting changed", () => {
        const result = setExtension(spread, "space", ["com.example", "steps"], 4, {
            input: { mode: "dark" },
        });

        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "add",
                    file: "dark.json",
                    jsonPath: ["space", "$extensions", "com.example"],
                    value: { steps: 4, from: "b" },
                },
            ],
            alsoAffects: [],
            moved: [],
        });
    });

    it("changes a context's own extension where that context's file writes it", () => {
        const result = setExtension(spread, "space", ["org.other", "kept"], true, {
            input: { mode: "dark" },
        });

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "dark.json",
                jsonPath: ["space", "$extensions", "org.other", "kept"],
                value: true,
                was: false,
            },
        ]);
    });

    it("writes at a place it is given", () => {
        const a = spread.writtenAt("space").find(({ span }) => span.file === "a.json");
        if (!a) throw new Error("a.json writes space");

        expect(
            opsOf(setExtension(spread, "space", ["org.other", "kept"], false, { at: a.span })),
        ).toEqual([
            {
                kind: "set",
                file: "a.json",
                jsonPath: ["space", "$extensions", "org.other", "kept"],
                value: false,
                was: true,
            },
        ]);
    });

    it("refuses a context with no file of its own, or one a later file would hide", () => {
        const later = opened({
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                    },
                    { type: "set", name: "last", sources: [{ $ref: "last.json" }] },
                ],
            }),
            "dark.json": "{}",
            "last.json": JSON.stringify({
                space: { $extensions: { "com.example": { steps: 1 } } },
            }),
        });

        expect(
            setExtension(spread, "space", ["com.example", "steps"], 4, { input: { mode: "dim" } })
                .refused?.kind,
        ).toBe("no-file-for-context");
        expect(
            setExtension(later, "space", ["com.example", "steps"], 4, { input: { mode: "dark" } })
                .refused,
        ).toMatchObject({ kind: "hidden-by-later-file", file: "last.json" });
    });

    it("changes nothing when asked to remove a setting a context doesn't use", () => {
        const result = setExtension(spread, "space", ["net.none", "x"], null, {
            input: { mode: "dark" },
        });

        expect(opsOf(result)).toEqual([]);
    });

    it("changes one item of a list inside an extension, keeping the others", () => {
        const listed = opened({
            ...twoFiles,
            "b.json": JSON.stringify({
                space: { $extensions: { "com.example": { at: [1, 2, 3] } } },
            }),
        });
        const result = setExtension(listed, "space", ["com.example", "at", 1], 5, {
            input: { mode: "dark" },
        });

        expect(opsOf(result)).toMatchObject([{ value: { at: [1, 5, 3] } }]);
        const past = setExtension(listed, "space", ["com.example", "at", 3], 5, {
            input: { mode: "dark" },
        });
        expect(opsOf(past)).toEqual([]);
    });

    it("keeps each setting where the file wrote it, in a copy for a context", () => {
        const result = setExtension(spread, "space", ["com.example", "steps"], 4, {
            input: { mode: "dark" },
        });
        const [op] = opsOf(result);

        expect(op && "value" in op && Object.keys(op.value as object)).toEqual(["steps", "from"]);
    });
});
