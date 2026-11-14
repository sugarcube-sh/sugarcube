import { type DesignTokens, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import {
    createDeprecationEdit,
    getDeprecationView,
    createDescriptionEdit,
    getDescriptionView,
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
const token = (path: string) => tokens.getPermutation().getToken(path)!;
const group = (path: string) => tokens.getPermutation().getGroup(path)!;

describe("a description", () => {
    it("is a token's own, editable", () => {
        expect(getDescriptionView(token("own.n"), true)).toEqual({ text: "", editable: true });
        expect(getDescriptionView(group("plain"), true)).toEqual({
            text: "Plain.",
            editable: true,
        });
    });

    it("says which group it comes from when a group takes it through $extends", () => {
        expect(getDescriptionView(group("primary"), true)).toEqual({
            text: "The base.",
            editable: true,
            from: "button",
        });
        expect(getDescriptionView(group("secondary"), true)).toEqual({
            text: "Its own.",
            editable: true,
        });
    });

    it("can't be edited where the page can't edit", () => {
        expect(getDescriptionView(group("plain"), false).editable).toBe(false);
    });

    it("is written as typed, and removed when the box is emptied, as one field", () => {
        const typed = createDescriptionEdit(tokens, "plain", "Words.");
        const emptied = createDescriptionEdit(tokens, "plain", "");

        expect(typed.result.ops).toEqual([
            expect.objectContaining({ kind: "set", value: "Words.", was: "Plain." }),
        ]);
        expect(emptied.result.ops).toEqual([expect.objectContaining({ kind: "remove" })]);
        expect(typed.options.mergeKey).toBe(emptied.options.mergeKey);
        expect(typed.options.mergeKey).not.toBe(
            createDescriptionEdit(tokens, "own", "x").options.mergeKey,
        );
    });
});

describe("a deprecation", () => {
    it("is its own: a ticked box, and unticking removes it", () => {
        expect(getDeprecationView(token("own.n"), true)).toEqual({
            notice: {},
            checkbox: { checked: true, uncheckedValue: null, message: "" },
        });
        expect(getDeprecationView(group("own"), true)).toEqual({
            notice: { message: "Use gap" },
            checkbox: { checked: true, uncheckedValue: null, message: "Use gap" },
        });
    });

    it("is none: an empty box and no line", () => {
        expect(getDeprecationView(token("plain.n"), true)).toEqual({
            checkbox: { checked: false, uncheckedValue: null, message: "" },
        });
        expect(getDeprecationView(token("kept.n"), true)).toEqual({
            checkbox: { checked: false, uncheckedValue: null, message: "" },
        });
    });

    it("comes from a group above: the line names it, and there is no box", () => {
        expect(getDeprecationView(token("old.n"), true)).toEqual({
            notice: { group: "old", message: "Use new" },
        });
        expect(getDeprecationView(group("old.inner"), true)).toEqual({
            notice: { group: "old", message: "Use new" },
        });
    });

    it("comes through $extends: the line names it, and unticking says not deprecated", () => {
        expect(getDeprecationView(group("primary"), true)).toEqual({
            notice: { group: "button", message: "Use action" },
            checkbox: { checked: true, uncheckedValue: false, message: "Use action" },
        });
    });

    it("has no box where the page can't edit", () => {
        expect(getDeprecationView(token("own.n"), false)).toEqual({ notice: {} });
    });

    it("writes the reason, or true with none, and what unticking writes, as one field", () => {
        const none = getDeprecationView(token("plain.n"), true).checkbox!;
        const own = getDeprecationView(token("own.n"), true).checkbox!;
        const extended = getDeprecationView(group("primary"), true).checkbox!;
        const ticked = createDeprecationEdit(tokens, "plain.n", none, true, "");
        const reasoned = createDeprecationEdit(tokens, "plain.n", none, true, "Use gap");

        expect(ticked.result.ops).toEqual([expect.objectContaining({ kind: "add", value: true })]);
        expect(reasoned.result.ops).toEqual([
            expect.objectContaining({ kind: "add", value: "Use gap" }),
        ]);
        expect(ticked.options.mergeKey).toBe(reasoned.options.mergeKey);
        expect(ticked.options.mergeKey).not.toBe(
            createDescriptionEdit(tokens, "plain.n", "x").options.mergeKey,
        );
        expect(createDeprecationEdit(tokens, "own.n", own, false, "").result.ops).toEqual([
            expect.objectContaining({ kind: "remove" }),
        ]);
        expect(createDeprecationEdit(tokens, "primary", extended, false, "").result.ops).toEqual([
            expect.objectContaining({ kind: "add", value: false }),
        ]);
    });
});
