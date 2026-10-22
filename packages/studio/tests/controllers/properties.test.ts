import { type DesignTokens, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import {
    deprecationEdit,
    deprecationView,
    descriptionEdit,
    descriptionView,
} from "../../src/controllers/properties";

function oneFile(json: unknown): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } });
}

const tokens = oneFile({
    $type: "number",
    plain: { $description: "Plain.", n: { $value: 1 } },
    own: { $deprecated: "Use gap", n: { $deprecated: true, $value: 1 } },
    old: { $deprecated: "Use new", n: { $value: 1 }, inner: { m: { $value: 1 } } },
    kept: { $deprecated: false, n: { $value: 1 } },
    button: { $description: "The base.", $deprecated: "Use action", pad: { $value: 4 } },
    primary: { $extends: "{button}", gap: { $value: 2 } },
    secondary: { $extends: "{button}", $description: "Its own.", gap: { $value: 2 } },
});
const token = (path: string) => tokens.permutation().token(path)!;
const group = (path: string) => tokens.permutation().group(path)!;

describe("a description", () => {
    it("is a token's own, editable", () => {
        expect(descriptionView(token("own.n"), true)).toEqual({ text: "", editable: true });
        expect(descriptionView(group("plain"), true)).toEqual({ text: "Plain.", editable: true });
    });

    it("says which group it comes from when a group takes it through $extends", () => {
        expect(descriptionView(group("primary"), true)).toEqual({
            text: "The base.",
            editable: true,
            from: "button",
        });
        expect(descriptionView(group("secondary"), true)).toEqual({
            text: "Its own.",
            editable: true,
        });
    });

    it("can't be edited where the page can't edit", () => {
        expect(descriptionView(group("plain"), false).editable).toBe(false);
    });

    it("is written as typed, and removed when the box is emptied, as one field", () => {
        const typed = descriptionEdit(tokens, "plain", "Words.");
        const emptied = descriptionEdit(tokens, "plain", "");

        expect(typed.result.ops).toEqual([
            expect.objectContaining({ kind: "set", value: "Words.", was: "Plain." }),
        ]);
        expect(emptied.result.ops).toEqual([expect.objectContaining({ kind: "remove" })]);
        expect(typed.options.merge).toBe(emptied.options.merge);
        expect(typed.options.merge).not.toBe(descriptionEdit(tokens, "own", "x").options.merge);
    });
});

describe("a deprecation", () => {
    it("is its own: a ticked box, and unticking removes it", () => {
        expect(deprecationView(token("own.n"), true)).toEqual({
            line: {},
            box: { checked: true, untick: null, message: "" },
        });
        expect(deprecationView(group("own"), true)).toEqual({
            line: { message: "Use gap" },
            box: { checked: true, untick: null, message: "Use gap" },
        });
    });

    it("is none: an empty box and no line", () => {
        expect(deprecationView(token("plain.n"), true)).toEqual({
            box: { checked: false, untick: null, message: "" },
        });
        expect(deprecationView(token("kept.n"), true)).toEqual({
            box: { checked: false, untick: null, message: "" },
        });
    });

    it("comes from a group above: the line names it, and there is no box", () => {
        expect(deprecationView(token("old.n"), true)).toEqual({
            line: { by: "old", message: "Use new" },
        });
        expect(deprecationView(group("old.inner"), true)).toEqual({
            line: { by: "old", message: "Use new" },
        });
    });

    it("comes through $extends: the line names it, and unticking says not deprecated", () => {
        expect(deprecationView(group("primary"), true)).toEqual({
            line: { by: "button", message: "Use action" },
            box: { checked: true, untick: false, message: "Use action" },
        });
    });

    it("has no box where the page can't edit", () => {
        expect(deprecationView(token("own.n"), false)).toEqual({ line: {} });
    });

    it("writes the reason, or true with none, and what unticking writes, as one field", () => {
        const none = deprecationView(token("plain.n"), true).box!;
        const own = deprecationView(token("own.n"), true).box!;
        const extended = deprecationView(group("primary"), true).box!;
        const ticked = deprecationEdit(tokens, "plain.n", none, true, "");
        const reasoned = deprecationEdit(tokens, "plain.n", none, true, "Use gap");

        expect(ticked.result.ops).toEqual([expect.objectContaining({ kind: "add", value: true })]);
        expect(reasoned.result.ops).toEqual([
            expect.objectContaining({ kind: "add", value: "Use gap" }),
        ]);
        expect(ticked.options.merge).toBe(reasoned.options.merge);
        expect(ticked.options.merge).not.toBe(
            descriptionEdit(tokens, "plain.n", "x").options.merge,
        );
        expect(deprecationEdit(tokens, "own.n", own, false, "").result.ops).toEqual([
            expect.objectContaining({ kind: "remove" }),
        ]);
        expect(deprecationEdit(tokens, "primary", extended, false, "").result.ops).toEqual([
            expect.objectContaining({ kind: "add", value: false }),
        ]);
    });
});
