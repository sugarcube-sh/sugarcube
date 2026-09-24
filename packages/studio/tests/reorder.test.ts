import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeTrees, resolveTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { reorderKeyAt } from "../src/tokens/text-edits";
import { sources } from "./text-sources";
const TOKENS = join(__dirname, "../demo");
const colorJson = () => readFileSync(join(TOKENS, "color.json"), "utf8");
const keysOf = (text: string) => Object.keys(JSON.parse(text).color);

describe("reordering a key", () => {
    it("moves it to the position asked for", () => {
        const before = colorJson();
        const was = keysOf(before);
        const after = reorderKeyAt(before, ["color"], "brand", 4) as string;

        expect(keysOf(after)).not.toEqual(was);
        expect(keysOf(after).indexOf("brand")).toBe(4);
        expect(keysOf(after).sort()).toEqual(was.sort());
    });

    it("moves it to the front, past the group's own metadata", () => {
        const after = reorderKeyAt(colorJson(), ["color"], "neutral", 0) as string;
        expect(keysOf(after)[0]).toBe("neutral");
    });

    it("leaves every property's own text exactly as it was", () => {
        const before = colorJson();
        const after = reorderKeyAt(before, ["color"], "brand", 4) as string;

        const was = JSON.parse(before).color;
        const now = JSON.parse(after).color;
        for (const key of Object.keys(was)) {
            expect(JSON.stringify(now[key])).toBe(JSON.stringify(was[key]));
        }
        expect(after.split("\n")).toHaveLength(before.split("\n").length);
    });

    it("keeps a comment sitting inside a moved property", () => {
        const source = '{\n  "a": {\n    // keep me\n    "x": 1\n  },\n  "b": { "y": 2 }\n}';
        const after = reorderKeyAt(source, [], "a", 1) as string;

        expect(after).toContain("// keep me");
        expect(after.indexOf('"b"')).toBeLessThan(after.indexOf('"a"'));
    });

    it("says so when the key or the parent is not there", () => {
        expect(reorderKeyAt(colorJson(), ["color"], "nope", 0)).toBeUndefined();
        expect(reorderKeyAt(colorJson(), ["nope"], "brand", 0)).toBeUndefined();
    });

    it("is a no-op when it is already there", () => {
        const before = colorJson();
        const at = keysOf(before).indexOf("brand");

        expect(at).toBe(2);
        expect(reorderKeyAt(before, ["color"], "brand", at)).toBe(before);
    });
});

describe("what a reorder does to the document", () => {
    it("changes no value anywhere, and still resolves identically", () => {
        const before = sources();
        const file = Object.keys(before.files).find((p) => p.endsWith("color.json")) as string;
        const after = {
            ...before,
            files: {
                ...before.files,
                [file]: reorderKeyAt(before.files[file] as string, ["color"], "brand", 4) as string,
            },
        };

        const was = resolveTokens(composeTrees(before).trees).resolved;
        const now = resolveTokens(composeTrees(after).trees).resolved;

        expect(Object.keys(now).sort()).toEqual(Object.keys(was).sort());
        for (const key of Object.keys(was)) {
            expect(JSON.stringify(now[key])).toBe(JSON.stringify(was[key]));
        }
    });

    it("is visible in the file, which is where it lives", () => {
        const before = colorJson();
        const after = reorderKeyAt(before, ["color"], "brand", 4) as string;

        expect(after).not.toBe(before);
        expect(keysOf(after)).not.toEqual(keysOf(before));
    });
});
