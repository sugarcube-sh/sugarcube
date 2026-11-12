import { type DesignTokens, readFromMemory, type JsonValue } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { type FileOp, type Question, apply, commit } from "../src/index.js";
import { demo, at, changed } from "./helpers.js";
function applied(tokens: DesignTokens, ops: FileOp[]): DesignTokens {
    const result = apply(tokens, ops);
    if (result.conflicts) throw new Error(JSON.stringify(result.conflicts));
    return result.tokens;
}

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const brand500 = ["color", "brand", "500", "$value"];
const setBrand500 = (tokens: DesignTokens): FileOp => ({
    kind: "set",
    file: "color.json",
    jsonPath: brand500,
    value: red,
    was: at(tokens, "color.json", brand500) as JsonValue,
});

describe("apply's result", () => {
    it("holds the new design tokens as tokens, tested by its field as commit's is", () => {
        const result = apply(demo, [setBrand500(demo)]);
        expect(result.conflicts).toBeUndefined();
        expect(result.tokens && at(result.tokens, "color.json", brand500)).toEqual(red);
    });
});

describe("apply, set", () => {
    it("changes the value, and the design tokens read again show it", () => {
        const after = applied(demo, [setBrand500(demo)]);

        expect(at(after, "color.json", brand500)).toEqual(red);
        expect(after.getPermutation().getToken("color.brand.500")?.original?.value).toEqual(red);
    });

    it("still applies after someone changed another token in the same file", () => {
        const op = setBrand500(demo);
        const theirs = changed(demo, [["color.json", ["color", "brand", "600", "$value"], "#000"]]);

        const after = applied(theirs, [op]);

        expect(at(after, "color.json", brand500)).toEqual(red);
        expect(at(after, "color.json", ["color", "brand", "600", "$value"])).toBe("#000");
    });

    it("is a conflict when someone changed the same value, and writes nothing over it", () => {
        const op = setBrand500(demo);
        const theirs = changed(demo, [["color.json", brand500, "#000"]]);

        const result = apply(theirs, [op]);

        expect(result).toEqual({
            conflicts: [{ op, kind: "changed", reason: expect.any(String) }],
        });
    });

    it("still applies when someone wrote the same value with its keys in another order", () => {
        const op = setBrand500(demo);
        const written = at(demo, "color.json", brand500) as Record<string, JsonValue>;
        const { hex, ...rest } = written;
        const reordered = { hex, ...rest } as JsonValue;
        const theirs = changed(demo, [["color.json", brand500, reordered]]);

        expect(at(applied(theirs, [op]), "color.json", brand500)).toEqual(red);
    });

    it("does nothing when someone already made the same change", () => {
        const op = setBrand500(demo);
        const theirs = changed(demo, [["color.json", brand500, red]]);

        expect(applied(theirs, [op]).toMemory().files).toEqual(theirs.toMemory().files);
    });

    it("is a conflict when the place has gone", () => {
        const op = setBrand500(demo);
        const theirs = changed(demo, [["color.json", ["color", "brand"], {}]]);

        expect(apply(theirs, [op])).toEqual({
            conflicts: [{ op, kind: "gone", reason: expect.any(String) }],
        });
    });
});

describe("apply, add", () => {
    it("makes the groups the new token needs", () => {
        const after = applied(demo, [
            {
                kind: "add",
                file: "space.json",
                jsonPath: ["color", "raw", "red"],
                value: { $type: "color", $value: red },
            },
        ]);

        expect(at(after, "space.json", ["color", "raw", "red", "$value"])).toEqual(red);
        expect(after.getPermutation().getToken("color.raw.red")?.original?.value).toEqual(red);
    });

    it("is a conflict when someone already made something different there", () => {
        const op: FileOp = {
            kind: "add",
            file: "color.json",
            jsonPath: ["color", "brand", "950"],
            value: { $value: red },
        };
        const theirs = changed(demo, [
            ["color.json", ["color", "brand", "950"], { $value: "#000" }],
        ]);

        expect(apply(theirs, [op])).toEqual({
            conflicts: [{ op, kind: "taken", reason: expect.any(String) }],
        });
    });

    it("does nothing when someone already made the same token", () => {
        const op: FileOp = {
            kind: "add",
            file: "color.json",
            jsonPath: ["color", "brand", "950"],
            value: { $value: red },
        };
        const theirs = changed(demo, [["color.json", ["color", "brand", "950"], { $value: red }]]);

        expect(applied(theirs, [op]).toMemory().files).toEqual(theirs.toMemory().files);
    });

    it("is a conflict when the path runs through a value that isn't a group", () => {
        const op: FileOp = {
            kind: "add",
            file: "color.json",
            jsonPath: ["color", "text", "brand", "$value", "hex"],
            value: "#ff0000",
        };

        expect(apply(demo, [op])).toEqual({
            conflicts: [{ op, kind: "not-a-group", reason: expect.any(String) }],
        });
    });

    it("is a conflict in a file the design tokens aren't read from", () => {
        const op: FileOp = {
            kind: "add",
            file: "nope.json",
            jsonPath: ["a"],
            value: { $value: 1 },
        };

        expect(apply(demo, [op])).toEqual({
            conflicts: [
                {
                    op,
                    kind: "not-read",
                    reason: "`nope.json` is not one of the files read",
                },
            ],
        });
    });
});

const sm = ["radius", "sm"];
const removeSm = (): FileOp => ({
    kind: "remove",
    file: "radius.json",
    jsonPath: sm,
    was: at(demo, "radius.json", sm) as JsonValue,
});

describe("apply, remove", () => {
    it("removes it", () => {
        const after = applied(demo, [removeSm()]);

        expect(at(after, "radius.json", sm)).toBeUndefined();
        expect(after.getPermutation().getToken("radius.sm")).toBeUndefined();
    });

    it("does nothing when it is already gone", () => {
        const theirs = applied(demo, [removeSm()]);

        expect(applied(theirs, [removeSm()]).toMemory().files).toEqual(theirs.toMemory().files);
    });

    it("is a conflict when someone changed it since", () => {
        const op = removeSm();
        const theirs = changed(demo, [["radius.json", [...sm, "$value", "value"], 0.2]]);

        expect(apply(theirs, [op])).toEqual({
            conflicts: [{ op, kind: "changed", reason: expect.any(String) }],
        });
    });
});

describe("apply, renameKey", () => {
    const rename = (name: string): FileOp => ({
        kind: "renameKey",
        file: "radius.json",
        jsonPath: sm,
        name,
        was: at(demo, "radius.json", sm) as JsonValue,
    });

    it("is a conflict when a sibling has taken the name since", () => {
        const op = rename("md");

        expect(apply(demo, [op])).toEqual({
            conflicts: [{ op, kind: "taken", reason: expect.any(String) }],
        });
    });

    it("is a conflict when the key has gone", () => {
        const op = rename("small");
        const theirs = applied(demo, [removeSm()]);

        expect(apply(theirs, [op])).toEqual({
            conflicts: [{ op, kind: "gone", reason: expect.any(String) }],
        });
    });

    it("does nothing when someone already made the same rename", () => {
        const op = rename("small");
        const theirs = applied(demo, [op]);

        expect(applied(theirs, [op]).toMemory().files).toEqual(theirs.toMemory().files);
    });

    it("is a conflict when the key has gone and the new name holds a different token", () => {
        const op = rename("small");
        const theirs = applied(demo, [
            removeSm(),
            {
                kind: "add",
                file: "radius.json",
                jsonPath: ["radius", "small"],
                value: { $value: { value: 0.2, unit: "rem" } },
            },
        ]);

        expect(apply(theirs, [op])).toEqual({
            conflicts: [{ op, kind: "gone", reason: expect.any(String) }],
        });
    });

    it("still renames when someone changed the value since", () => {
        const op = rename("small");
        const theirs = changed(demo, [["radius.json", [...sm, "$value", "value"], 0.2]]);

        const after = applied(theirs, [op]);

        expect(at(after, "radius.json", ["radius", "small", "$value", "value"])).toBe(0.2);
        expect(at(after, "radius.json", sm)).toBeUndefined();
    });
});

describe("apply, several edits", () => {
    it("leaves every line it does not change byte for byte", () => {
        const jsonPath = ["radius", "sm", "$value"];
        const after = applied(demo, [
            {
                kind: "set",
                file: "radius.json",
                jsonPath,
                value: { value: 2, unit: "px" },
                was: at(demo, "radius.json", jsonPath) as JsonValue,
            },
        ]);
        const before = (demo.getText("radius.json") ?? "").split("\n");
        const lines = (after.getText("radius.json") ?? "").split("\n");

        expect(lines.length).toBe(before.length);
        expect(lines.filter((line, i) => line !== before[i])).toEqual([
            '    "sm": { "$value": { "value": 2, "unit": "px" } },',
        ]);
    });

    it("applies edits to one file in order", () => {
        const after = applied(demo, [
            {
                kind: "renameKey",
                file: "radius.json",
                jsonPath: sm,
                name: "small",
                was: at(demo, "radius.json", sm) as JsonValue,
            },
            {
                kind: "set",
                file: "radius.json",
                jsonPath: ["radius", "small", "$value"],
                value: { value: 2, unit: "px" },
                was: at(demo, "radius.json", ["radius", "sm", "$value"]) as JsonValue,
            },
        ]);

        expect(at(after, "radius.json", ["radius", "small", "$value"])).toEqual({
            value: 2,
            unit: "px",
        });
        expect(after.getPermutation().getToken("radius.sm")).toBeUndefined();
    });

    it("applies none when one is a conflict, and names every conflict", () => {
        const set: FileOp = {
            kind: "set",
            file: "radius.json",
            jsonPath: ["radius", "sm", "$value"],
            value: { value: 2, unit: "px" },
            was: at(demo, "radius.json", ["radius", "sm", "$value"]) as JsonValue,
        };
        const takenName: FileOp = {
            kind: "renameKey",
            file: "color.json",
            jsonPath: ["color", "brand"],
            name: "neutral",
            was: at(demo, "color.json", ["color", "brand"]) as JsonValue,
        };
        const gone: FileOp = {
            kind: "set",
            file: "color.json",
            jsonPath: ["color", "nope", "$value"],
            value: red,
            was: "#000",
        };

        const result = apply(demo, [set, takenName, gone]);

        expect(result).toEqual({
            conflicts: [
                { op: takenName, kind: "taken", reason: expect.any(String) },
                { op: gone, kind: "gone", reason: expect.any(String) },
            ],
        });
    });
});

describe("apply, files", () => {
    const resolver = {
        version: "2025.10",
        resolutionOrder: [
            {
                type: "set",
                name: "base",
                sources: [{ $ref: "./base.json" }, { $ref: "./more.json" }],
            },
        ],
    };
    const named = readFromMemory({
        files: {
            "tokens.resolver.json": `${JSON.stringify(resolver, null, 2)}\n`,
            "base.json": '{\n  "a": { "$type": "number", "$value": 1 }\n}\n',
        },
    });
    const created: FileOp = {
        kind: "createFile",
        file: "more.json",
        value: { b: { $type: "number", $value: 2 } },
    };

    it("creates a file, written in the design tokens' indent", () => {
        const after = applied(named, [created]);

        expect(after.getText("more.json")).toBe(
            '{\n  "b": {\n    "$type": "number",\n    "$value": 2\n  }\n}\n',
        );
        expect(after.getPermutation().getToken("b")).toBeDefined();
    });

    it("does nothing when the file already holds the same, and is a conflict when it holds other", () => {
        const same = applied(named, [created]);
        expect(applied(same, [created]).toMemory().files).toEqual(same.toMemory().files);

        const other = applied(named, [
            { ...created, value: { c: { $type: "number", $value: 3 } } },
        ]);
        expect(apply(other, [created])).toEqual({
            conflicts: [{ op: created, kind: "taken", reason: expect.any(String) }],
        });
    });

    it("is a conflict when nothing would read the new file", () => {
        const op: FileOp = { kind: "createFile", file: "unread.json", value: {} };

        expect(apply(demo, [op])).toEqual({
            conflicts: [
                {
                    op,
                    kind: "not-read",
                    reason: "nothing reads `unread.json`, so it would be lost",
                },
            ],
        });
    });

    it("deletes a file only as it was, and does nothing when it is already gone", () => {
        const both = applied(named, [created]);
        const deleted: FileOp = {
            kind: "deleteFile",
            file: "more.json",
            was: both.getText("more.json") ?? "",
        };

        const after = applied(both, [deleted]);
        expect(after.getText("more.json")).toBeUndefined();
        expect(after.getPermutation().getToken("b")).toBeUndefined();
        expect(applied(after, [deleted]).toMemory().files).toEqual(after.toMemory().files);

        const edited = { ...deleted, was: "{}" };
        expect(apply(both, [edited])).toEqual({
            conflicts: [{ op: edited, kind: "changed", reason: expect.any(String) }],
        });
    });
});

describe("commit", () => {
    it("applies an operation's edits and hands back what it did", () => {
        const ops = [setBrand500(demo)];
        const done = commit(demo, {
            ops,
            alsoAffects: demo.permutations.select(() => false),
            moved: [],
        });

        expect(done).toEqual({ tokens: expect.anything(), ops, moved: [] });
        if (!done.tokens) throw new Error("not committed");
        expect(at(done.tokens, "color.json", brand500)).toEqual(red);
    });

    it("passes a question or a refusal through untouched", () => {
        const question: Question = {
            kind: "placement",
            path: "a",
            files: ["x.json"],
            answer: () => ({ refused: { kind: "not-found", path: "a", reason: "no" } }),
        };

        expect(commit(demo, { question })).toEqual({ question });
        expect(commit(demo, { refused: { kind: "not-found", path: "a", reason: "no" } })).toEqual({
            refused: { kind: "not-found", path: "a", reason: "no" },
        });
    });

    it("hands back the conflicts when the edits no longer apply", () => {
        const op = setBrand500(demo);
        const theirs = changed(demo, [["color.json", brand500, "#000"]]);

        expect(
            commit(theirs, {
                ops: [op],
                alsoAffects: demo.permutations.select(() => false),
                moved: [],
            }),
        ).toEqual({
            conflicts: [{ op, kind: "changed", reason: expect.any(String) }],
        });
    });
});
