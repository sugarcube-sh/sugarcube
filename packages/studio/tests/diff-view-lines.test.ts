import { describe, expect, it } from "vitest";
import { entryLines } from "../src/inspector/DiffView";
import type { TokenDiffEntry } from "../src/tokens/types";

function entry(overrides: Partial<TokenDiffEntry>): TokenDiffEntry {
    const path = overrides.path ?? "color.bg";
    return {
        kind: "changed",
        handle: path,
        path,
        basePath: path,
        sourcePath: "color.json",
        contexts: [],
        from: { $value: "#fff" },
        to: { $value: "#000" },
        ...overrides,
    };
}

const kinds = (lines: Array<{ kind: string }>) => new Set(lines.map((line) => line.kind));

describe("entryLines", () => {
    it("shows a deletion as the whole token going, with nothing after it", () => {
        const lines = entryLines(entry({ kind: "removed", to: {} }));

        expect(kinds(lines)).toEqual(new Set(["removed"]));
        expect(lines.map((line) => line.text).join("\n")).toContain('"$value": "#fff"');
        expect(lines.some((line) => line.text.trim() === "{}")).toBe(false);
    });

    it("shows an addition as the whole token arriving, with nothing before it", () => {
        const lines = entryLines(
            entry({ kind: "added", basePath: undefined, from: {}, to: { $value: "#ccc" } }),
        );

        expect(kinds(lines)).toEqual(new Set(["added"]));
        expect(lines.map((line) => line.text).join("\n")).toContain('"$value": "#ccc"');
        expect(lines.some((line) => line.text.trim() === "{}")).toBe(false);
    });

    it("still diffs a plain value change line by line", () => {
        const lines = entryLines(entry({ kind: "changed" }));

        expect(kinds(lines).has("removed")).toBe(true);
        expect(kinds(lines).has("added")).toBe(true);
    });

    it("diffs a rename's values rather than reprinting the token", () => {
        const lines = entryLines(
            entry({ kind: "renamed", path: "color.background", basePath: "color.bg" }),
        );

        expect(kinds(lines).has("context")).toBe(true);
    });
});
