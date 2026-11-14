import { describe, expect, it } from "vitest";
import { type FileOp, getChangedFiles, rename, setValue } from "../src/index.js";
import { asEdits, committed, demo, opsOf } from "./helpers.js";

const half = { value: 0.5, unit: "rem" };
const gradientSource = { $ref: "./gradient.json" };
const sources = ["resolutionOrder", 0, "sources"];
const listed = JSON.parse(demo.getText("tokens.resolver.json") ?? "").resolutionOrder[0].sources;

const unnamed: FileOp = {
    kind: "remove",
    file: "tokens.resolver.json",
    jsonPath: [...sources, 8],
    was: gradientSource,
};

describe("getChangedFiles", () => {
    it("gives the new text of each file the edits change, and no other", () => {
        const result = getChangedFiles(demo, asEdits(opsOf(setValue(demo, "radius.md", half))));
        if (result.conflicts) throw new Error("conflicts");

        expect(Object.keys(result.textByFile)).toStrictEqual(["radius.json"]);
        expect(JSON.parse(result.textByFile["radius.json"] ?? "").radius.md.$value).toEqual(half);
        expect(result.deleted).toStrictEqual([]);
    });

    it("leaves out a file the edits leave as it was", () => {
        const away = rename(demo, "radius.md", "medium");
        const renamed = committed(demo, away);
        const back = opsOf(rename(renamed, "radius.medium", "md"));
        const result = getChangedFiles(demo, asEdits([...opsOf(away), ...back]));
        if (result.conflicts) throw new Error("conflicts");

        expect(result.textByFile).toStrictEqual({});
        expect(result.deleted).toStrictEqual([]);
    });

    it("deletes a file only when an edit deletes it", () => {
        const deleting: FileOp = {
            kind: "delete-file",
            file: "gradient.json",
            was: demo.getText("gradient.json") ?? "",
        };
        const result = getChangedFiles(demo, asEdits([unnamed, deleting]));
        if (result.conflicts) throw new Error("conflicts");

        expect(result.deleted).toStrictEqual(["gradient.json"]);
        expect(Object.keys(result.textByFile)).toStrictEqual(["tokens.resolver.json"]);
    });

    it("deletes no file the design tokens aren't read from", () => {
        const result = getChangedFiles(
            demo,
            asEdits([{ kind: "delete-file", file: "package.json", was: "anything" }]),
        );
        if (result.conflicts) throw new Error("conflicts");

        expect(result.deleted).toStrictEqual([]);
        expect(result.textByFile).toStrictEqual({});
    });

    it("keeps a file the resolver stops naming", () => {
        const result = getChangedFiles(demo, asEdits([unnamed]));
        if (result.conflicts) throw new Error("conflicts");

        expect(result.deleted).toStrictEqual([]);
        expect(Object.keys(result.textByFile)).toStrictEqual(["tokens.resolver.json"]);
        expect(result.tokens.getText("gradient.json")).toBeUndefined();
    });

    it("writes a new file", () => {
        const result = getChangedFiles(
            demo,
            asEdits([
                { kind: "create-file", file: "extra.json", value: {} },
                {
                    kind: "set",
                    file: "tokens.resolver.json",
                    jsonPath: sources,
                    value: [...listed, { $ref: "./extra.json" }],
                    was: listed,
                },
            ]),
        );
        if (result.conflicts) throw new Error("conflicts");

        expect(Object.keys(result.textByFile).sort()).toStrictEqual([
            "extra.json",
            "tokens.resolver.json",
        ]);
        expect(JSON.parse(result.textByFile["extra.json"] ?? "")).toStrictEqual({});
    });

    it("gives the conflicts, and nothing to write, when an edit no longer applies", () => {
        const stale: FileOp = {
            kind: "set",
            file: "radius.json",
            jsonPath: ["radius", "md", "$value"],
            value: half,
            was: "not what is there",
        };
        expect(getChangedFiles(demo, asEdits([stale]))).toMatchObject({
            conflicts: [{ kind: "changed" }],
        });
    });
});
