import { readFromMemory, type JsonValue } from "@sugarcube-sh/dtcg";
import { describe, expect, it, vi } from "vitest";
import {
    type FileOp,
    create,
    createSession,
    remove,
    rename,
    setDescription,
    setValue,
} from "../src/index.js";
import { asEdits, at, changed, demo, opsIn, partsOf } from "./helpers.js";
const red = { colorSpace: "srgb", components: [1, 0, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };

describe("rebase", () => {
    it("takes files changed on disk as they are when nothing is unsaved", () => {
        const session = createSession(demo);
        const fresh = changed(demo, [
            ["radius.json", ["radius", "md", "$value"], { value: 0.75, unit: "rem" }],
        ]);

        expect(session.rebase(fresh)).toEqual([]);
        expect(session.tokens.toMemory().files).toEqual(fresh.toMemory().files);
        expect(session.opened).toBe(fresh);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);
    });

    it("keeps your edit and theirs when they are to different tokens in one file", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [["color.json", ["color", "brand", "600", "$value"], blue]]);

        expect(session.rebase(fresh)).toEqual([]);
        expect(
            session.tokens.getPermutation().getToken("color.brand.500")?.original?.value,
        ).toEqual(red);
        expect(
            session.tokens.getPermutation().getToken("color.brand.600")?.original?.value,
        ).toEqual(blue);
        expect(opsIn(session.unsaved)).toHaveLength(1);
        expect(session.changes().map((change) => change.path)).toEqual(["color.brand.500"]);
    });

    it("takes a file you haven't touched, and puts your edits back on one you have", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [
            ["radius.json", ["radius", "md", "$value"], { value: 0.75, unit: "rem" }],
        ]);

        session.rebase(fresh);
        expect(session.tokens.getText("radius.json")).toBe(fresh.getText("radius.json"));
        expect(
            session.tokens.getPermutation().getToken("color.brand.500")?.original?.value,
        ).toEqual(red);
    });

    it("keeps your part and theirs when you each changed a different part of one value", () => {
        const session = createSession(demo);
        session.do(
            setValue(session.tokens, "shadow.sm", "{color.neutral.900}", { part: ["color"] }),
        );
        const blur = ["shadow", "sm", "$value", "blur"];
        const fresh = changed(demo, [["shadow.json", blur, { value: 8, unit: "px" }]]);

        expect(session.rebase(fresh)).toEqual([]);
        expect(at(session.tokens, "shadow.json", ["shadow", "sm", "$value", "color"])).toBe(
            "{color.neutral.900}",
        );
        expect(at(session.tokens, "shadow.json", blur)).toEqual({ value: 8, unit: "px" });
    });

    it("hands back a clash over the whole token when you both changed one part", () => {
        const session = createSession(demo);
        session.do(
            setValue(session.tokens, "shadow.sm", "{color.neutral.900}", { part: ["color"] }),
        );
        const color = ["shadow", "sm", "$value", "color"];
        const fresh = changed(demo, [["shadow.json", color, "{color.neutral.800}"]]);

        const [part] = partsOf(session.rebase(fresh));

        expect(part).toMatchObject({
            file: "shadow.json",
            jsonPath: ["shadow", "sm"],
            path: "shadow.sm",
            yours: { $value: { color: "{color.neutral.900}" } },
            theirs: { $value: { color: "{color.neutral.800}" } },
        });
    });

    it("hands back one clash when you both changed a token, and shows theirs", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [["color.json", ["color", "brand", "500", "$value"], blue]]);

        expect(partsOf(session.rebase(fresh))).toEqual([
            {
                path: "color.brand.500",
                file: "color.json",
                jsonPath: ["color", "brand", "500"],
                yours: expect.objectContaining({ $value: red }),
                theirs: expect.objectContaining({ $value: blue }),
            },
        ]);
        expect(session.tokens).toBe(fresh);
        expect(session.unsaved).toEqual({ steps: [] });
    });

    it("gives your version of a clashing token with every edit of yours to it, those that fit too", () => {
        const session = createSession(demo);
        session.do(setDescription(session.tokens, "color.brand.500", "Mine."));
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [["color.json", ["color", "brand", "500", "$value"], blue]]);

        expect(partsOf(session.rebase(fresh))).toEqual([
            {
                path: "color.brand.500",
                file: "color.json",
                jsonPath: ["color", "brand", "500"],
                yours: { $value: red, $description: "Mine." },
                theirs: expect.objectContaining({ $value: blue }),
            },
        ]);
    });

    it("hands back a clash with no theirs when they removed the token you changed", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [["color.json", ["color", "brand", "500"], undefined]]);

        expect(partsOf(session.rebase(fresh))).toEqual([
            {
                path: "color.brand.500",
                file: "color.json",
                jsonPath: ["color", "brand", "500"],
                yours: { $value: red },
            },
        ]);
    });

    it("names a clash on a token written in the resolver by its token path", () => {
        const inline = (value: number) =>
            JSON.stringify({
                version: "2025.10",
                sets: {
                    base: { sources: [{ size: { $type: "number", sm: { $value: value } } }] },
                },
                resolutionOrder: [{ $ref: "#/sets/base" }],
            });
        const opened = readFromMemory({
            files: { "tokens.resolver.json": inline(1) },
            entryFile: "tokens.resolver.json",
        });
        const session = createSession(opened);
        session.do(setValue(session.tokens, "size.sm", 2));
        const fresh = readFromMemory({
            files: { "tokens.resolver.json": inline(3) },
            entryFile: "tokens.resolver.json",
        });

        expect(partsOf(session.rebase(fresh))).toEqual([
            {
                path: "size.sm",
                file: "tokens.resolver.json",
                jsonPath: ["sets", "base", "sources", 0, "size", "sm"],
                yours: { $value: 2 },
                theirs: { $value: 3 },
            },
        ]);
    });

    it("discards to what the files say now, not to what they said when opened", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [
            ["radius.json", ["radius", "md", "$value"], { value: 0.75, unit: "rem" }],
        ]);
        session.rebase(fresh);
        session.discard();

        expect(session.tokens).toBe(fresh);
    });

    it("keeps the id of a path still there, forgets one gone, and gives a new path a new one", () => {
        const session = createSession(demo);
        session.do(create(session.tokens, "color.highlight", { $type: "color", $value: red }));
        const made = session.idOf("color.highlight");
        const fresh = changed(demo, [
            ["radius.json", ["radius", "md"], undefined],
            ["radius.json", ["radius", "xl"], { $value: { value: 2, unit: "rem" } }],
        ]);
        session.rebase(fresh);

        expect(session.idOf("radius.sm")).toBe("radius.sm");
        expect(session.pathOf("radius.md")).toBeUndefined();
        const arrived = session.idOf("radius.xl");
        expect(arrived).toMatch(/^new:/);
        expect(session.idOf("color.highlight")).toBe(made);

        session.discard();
        expect(session.idOf("radius.xl")).toBe(arrived);
        expect(session.pathOf(made ?? "")).toBeUndefined();
    });

    it("puts a step back whole or not at all, so a rename is never half kept", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.text.default", "defaultttttt"));
        const fresh = changed(demo, [
            ["color.json", ["color", "text", "default"], undefined],
            ["color.json", ["color", "text", "body"], { $value: "{color.neutral.900}" }],
        ]);

        expect(session.rebase(fresh)).not.toEqual([]);
        expect(session.tokens.toMemory().files).toEqual(fresh.toMemory().files);
        expect(session.tokens.has("color.text.defaultttttt")).toBe(false);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);
    });

    it("keeps a later step that still fits when an earlier one is dropped", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.text.default", "defaultttttt"));
        session.do(setValue(session.tokens, "radius.md", { value: 1, unit: "rem" }));
        const fresh = changed(demo, [["color.json", ["color", "text", "default"], undefined]]);

        session.rebase(fresh);

        expect(session.unsaved.steps.map((step) => step.ops.map((op) => op.file))).toEqual([
            ["radius.json"],
        ]);
        expect(session.tokens.getPermutation().getToken("radius.md")?.original?.value).toEqual({
            value: 1,
            unit: "rem",
        });
    });

    it("names each clash by the token its edits were made to, before and after your rename", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "radius.md", "medium"));
        session.do(setValue(session.tokens, "radius.medium", { value: 1, unit: "rem" }));
        const fresh = changed(demo, [["radius.json", ["radius", "md"], undefined]]);

        expect(
            partsOf(session.rebase(fresh)).map(({ path, jsonPath }) => [path, jsonPath]),
        ).toEqual([
            ["radius.md", ["radius", "md"]],
            ["radius.medium", ["radius", "medium"]],
        ]);
    });

    it("drops the move of a rename that no longer fits, and keeps the change list honest", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "radius.md", "medium"));
        const fresh = changed(demo, [["radius.json", ["radius", "md"], undefined]]);

        expect(partsOf(session.rebase(fresh))).toMatchObject([
            { path: "radius.md", file: "radius.json", jsonPath: ["radius", "md"] },
        ]);
        expect(session.unsaved).toEqual({ steps: [] });
        expect(session.changes()).toEqual([]);
    });

    it("keeps the moves of renames made one after another when they fit", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "radius.md", "medium"));
        session.do(rename(session.tokens, "radius.medium", "mid"));
        const fresh = changed(demo, [
            ["radius.json", ["radius", "lg", "$value"], { value: 1, unit: "rem" }],
        ]);

        expect(session.rebase(fresh)).toEqual([]);
        expect(session.unsaved.steps.flatMap((step) => step.moves)).toEqual([
            { from: "radius.md", to: "radius.medium" },
            { from: "radius.medium", to: "radius.mid" },
        ]);
        expect(session.changes().map(({ kind, path }) => [kind, path])).toEqual([
            ["renamed", "radius.mid"],
        ]);
    });

    it("tells listeners", () => {
        const session = createSession(demo);
        const heard = vi.fn();
        session.subscribe(heard);
        session.rebase(
            changed(demo, [
                ["radius.json", ["radius", "md", "$value"], { value: 0.75, unit: "rem" }],
            ]),
        );

        expect(heard).toHaveBeenCalledTimes(1);
    });
});

describe("a clash", () => {
    it("is one per step that no longer fits, holding the step and each part of a file it changes", () => {
        const session = createSession(demo);
        session.do(rename(session.tokens, "color.text.default", "defaultttttt"));
        const [step] = session.unsaved.steps;
        const fresh = changed(demo, [
            ["color.json", ["color", "text", "default"], undefined],
            ["color.json", ["color", "text", "body"], { $value: "{color.neutral.900}" }],
        ]);

        const clashes = session.rebase(fresh);

        expect(clashes).toHaveLength(1);
        expect(clashes[0]?.step).toBe(step);
        expect(clashes[0]?.parts.map(({ file }) => file)).toEqual(["color.json", "dark.json"]);
        expect(clashes[0]?.keepable).toBe(false);
    });

    it("can be kept yours when every place your step changes is still there", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [["color.json", ["color", "brand", "500", "$value"], blue]]);

        expect(session.rebase(fresh)[0]?.keepable).toBe(true);
    });

    it("can't be kept yours when they removed or renamed what you changed", () => {
        const session = createSession(demo);
        session.do(setValue(session.tokens, "color.brand.500", red));
        const fresh = changed(demo, [["color.json", ["color", "brand", "500"], undefined]]);

        expect(session.rebase(fresh)[0]?.keepable).toBe(false);
    });

    it("can be kept yours when you removed what they changed", () => {
        const session = createSession(demo);
        session.do(remove(session.tokens, "radius.full"));
        const fresh = changed(demo, [
            ["radius.json", ["radius", "full", "$value"], { value: 1000, unit: "px" }],
        ]);

        expect(session.rebase(fresh)[0]?.keepable).toBe(true);
    });
});

describe("restore", () => {
    it("puts edits kept from before a reload back as unsaved, and discard still goes back to disk", () => {
        const before = createSession(demo);
        before.do(setValue(before.tokens, "color.text.brand", "{color.brand.800}"));
        before.do(remove(before.tokens, "radius.full"));
        const kept = before.unsaved;

        const session = createSession(demo);
        expect(session.restore(kept)).toEqual([]);
        expect(session.unsaved).toEqual(kept);
        expect(session.tokens.toMemory().files).toEqual(before.tokens.toMemory().files);

        session.discard();
        expect(session.tokens).toBe(demo);
    });

    it("keeps ids through the renames it puts back", () => {
        const before = createSession(demo);
        before.do(rename(before.tokens, "radius.md", "medium"));
        before.do(rename(before.tokens, "radius", "corner"));

        const session = createSession(demo);
        session.restore(before.unsaved);

        expect(session.pathOf("radius.md")).toBe("corner.medium");
        expect(session.pathOf("radius.sm")).toBe("corner.sm");
        expect(session.unsaved).toEqual(before.unsaved);
        expect(session.changes().map((change) => [change.kind, change.path])).toContainEqual([
            "renamed",
            "corner.medium",
        ]);
    });

    it("puts back the edits that fit and hands back a clash for each that doesn't", () => {
        const before = createSession(demo);
        before.do(setValue(before.tokens, "color.brand.500", red));
        before.do(setValue(before.tokens, "radius.md", { value: 1, unit: "rem" }));
        const kept = before.unsaved;
        const moved = changed(demo, [["color.json", ["color", "brand", "500", "$value"], blue]]);

        const session = createSession(moved);
        expect(partsOf(session.restore(kept))).toEqual([
            {
                path: "color.brand.500",
                file: "color.json",
                jsonPath: ["color", "brand", "500"],
                yours: expect.objectContaining({ $value: red }),
                theirs: expect.objectContaining({ $value: blue }),
            },
        ]);
        expect(session.tokens.getPermutation().getToken("radius.md")?.original?.value).toEqual({
            value: 1,
            unit: "rem",
        });
        expect(opsIn(session.unsaved)).toHaveLength(1);
    });

    it("leaves no trace of a step that fails part way, in a file a later step that fits also changes", () => {
        const fits: FileOp = {
            kind: "set",
            file: "radius.json",
            jsonPath: ["radius", "sm", "$value"],
            value: { value: 9, unit: "px" },
            was: at(demo, "radius.json", ["radius", "sm", "$value"]) as JsonValue,
        };
        const stale: FileOp = {
            kind: "set",
            file: "radius.json",
            jsonPath: ["radius", "md", "$value"],
            value: { value: 1, unit: "rem" },
            was: "not what is there",
        };
        const later: FileOp = {
            kind: "set",
            file: "radius.json",
            jsonPath: ["radius", "lg", "$value"],
            value: { value: 2, unit: "rem" },
            was: at(demo, "radius.json", ["radius", "lg", "$value"]) as JsonValue,
        };
        const session = createSession(demo);

        session.restore({
            steps: [
                { ops: [fits, stale], moves: [] },
                { ops: [later], moves: [] },
            ],
        });

        expect(at(session.tokens, "radius.json", ["radius", "sm", "$value"])).toEqual(
            at(demo, "radius.json", ["radius", "sm", "$value"]),
        );
        expect(at(session.tokens, "radius.json", ["radius", "lg", "$value"])).toEqual({
            value: 2,
            unit: "rem",
        });
        expect(session.unsaved.steps).toEqual([{ ops: [later], moves: [] }]);
    });

    it("puts back a step whole or not at all after a reload", () => {
        const before = createSession(demo);
        before.do(rename(before.tokens, "color.text.default", "defaultttttt"));
        const elsewhere = changed(demo, [["color.json", ["color", "text", "default"], undefined]]);

        const session = createSession(elsewhere);
        session.restore(before.unsaved);

        expect(session.tokens).toBe(elsewhere);
        expect(session.unsaved).toEqual({ steps: [] });
    });

    it("puts back only the moves of the renames that fit", () => {
        const before = createSession(demo);
        before.do(rename(before.tokens, "radius.md", "medium"));
        before.do(rename(before.tokens, "radius.sm", "small"));
        const elsewhere = changed(demo, [["radius.json", ["radius", "md"], undefined]]);

        const session = createSession(elsewhere);
        session.restore(before.unsaved);
        expect(session.unsaved.steps.flatMap((step) => step.moves)).toEqual([
            { from: "radius.sm", to: "radius.small" },
        ]);
    });

    it("says where a clash on what is neither a token nor a group is, and names no token", () => {
        const sources = ["resolutionOrder", 0, "sources"];
        const listed = at(demo, "tokens.resolver.json", sources) as JsonValue[];
        const yours = [...listed, { $ref: "./extra.json" }];
        const mine: FileOp = {
            kind: "set",
            file: "tokens.resolver.json",
            jsonPath: sources,
            value: yours,
            was: listed,
        };
        const theirs = changed(demo, [["tokens.resolver.json", sources, listed.slice(1)]]);

        const session = createSession(theirs);
        expect(partsOf(session.restore(asEdits([mine])))).toEqual([
            { file: "tokens.resolver.json", jsonPath: sources, yours, theirs: listed.slice(1) },
        ]);
    });

    it("hands back a clash for an edit to a file that is gone, naming no token, since none is known", () => {
        const op: FileOp = {
            kind: "set",
            file: "gone.json",
            jsonPath: ["glow", "$value"],
            value: 1,
            was: 0,
        };
        const session = createSession(demo);

        const heard = vi.fn();
        session.subscribe(heard);
        expect(partsOf(session.restore(asEdits([op])))).toEqual([
            { file: "gone.json", jsonPath: ["glow"], yours: { $value: 1 } },
        ]);
        expect(session.tokens).toBe(demo);
        expect(heard).not.toHaveBeenCalled();
    });
});
