import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectFormatting, removeAt, renameKeyAt, setAt } from "../src/tokens/text-edits";

const TOKENS = join(__dirname, "../demo");
const colorJson = () => readFileSync(join(TOKENS, "color.json"), "utf8");

const changedLines = (before: string, after: string) => {
    const a = before.split("\n");
    const b = after.split("\n");
    const lines: number[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) lines.push(i + 1);
    }
    return lines;
};

describe("renameKeyAt", () => {
    it("renames a group in place, touching one line", () => {
        const before = colorJson();
        const after = renameKeyAt(before, ["color", "brand"], "primary") as string;

        expect(changedLines(before, after)).toHaveLength(1);
        expect(after.split("\n").length).toBe(before.split("\n").length);
    });

    it("leaves every child, and the group's own description, where they were", () => {
        const before = colorJson();
        const after = JSON.parse(renameKeyAt(before, ["color", "brand"], "primary") as string);

        expect(after.color.brand).toBeUndefined();
        expect(Object.keys(after.color.primary)).toEqual(
            Object.keys(JSON.parse(before).color.brand),
        );
        expect(typeof after.color.primary.$description).toBe("string");
    });

    it("keeps the key in its original position", () => {
        const before = JSON.parse(colorJson());
        const after = JSON.parse(renameKeyAt(colorJson(), ["color", "brand"], "primary") as string);

        const was = Object.keys(before.color).indexOf("brand");
        expect(Object.keys(after.color).indexOf("primary")).toBe(was);
    });

    it("renames a token as readily as a group", () => {
        const after = JSON.parse(
            renameKeyAt(colorJson(), ["color", "brand", "500"], "base") as string,
        );

        expect(after.color.brand["500"]).toBeUndefined();
        expect(after.color.brand.base.$value).toBeDefined();
    });

    it("says so when the path is not there", () => {
        expect(renameKeyAt(colorJson(), ["color", "nope"], "x")).toBeUndefined();
    });
});

describe("setAt and removeAt", () => {
    it("changes one value and nothing else", () => {
        const before = colorJson();
        const after = setAt(before, ["color", "brand", "500", "$value"], "#ff0000");

        expect(JSON.parse(after).color.brand["500"].$value).toBe("#ff0000");
        expect(JSON.parse(after).color.brand["500"].$description).toBe(
            JSON.parse(before).color.brand["500"].$description,
        );
    });

    it("creates the nesting a new token needs", () => {
        const after = JSON.parse(
            setAt(colorJson(), ["color", "raw", "blue"], { $type: "color", $value: "#00f" }),
        );

        expect(after.color.raw.blue).toEqual({ $type: "color", $value: "#00f" });
        expect(after.color.brand).toBeDefined();
    });

    it("removes a key without disturbing its siblings", () => {
        const before = JSON.parse(colorJson());
        const after = JSON.parse(removeAt(colorJson(), ["color", "brand", "500"]));

        expect(after.color.brand["500"]).toBeUndefined();
        expect(Object.keys(after.color.brand)).toEqual(
            Object.keys(before.color.brand).filter((key) => key !== "500"),
        );
    });
});

describe("detectFormatting", () => {
    it("reads the demo's two-space indent", () => {
        expect(detectFormatting(colorJson())).toEqual({ tabSize: 2, insertSpaces: true });
    });

    it("notices four spaces and tabs", () => {
        expect(detectFormatting('{\n    "a": 1\n}')).toEqual({ tabSize: 4, insertSpaces: true });
        expect(detectFormatting('{\n\t"a": 1\n}')).toEqual({ tabSize: 1, insertSpaces: false });
    });

    it("takes the most common step when a file is inconsistent", () => {
        const mostlyTwo = '{\n  "a": 1,\n  "b": {\n    "c": 1,\n        "d": 2\n  }\n}';
        expect(detectFormatting(mostlyTwo).tabSize).toBe(2);
    });

    it("writes into a four-space file with four-space indent", () => {
        const source = '{\n    "color": {\n        "bg": { "$value": "#fff" }\n    }\n}';
        const after = setAt(source, ["color", "fg"], { $value: "#000" });

        expect(after).toContain('\n        "fg"');
    });

    it("keeps comments a plain rewrite would lose", () => {
        const source = '{\n  // the page background\n  "bg": { "$value": "#fff" }\n}';
        const after = setAt(source, ["bg", "$value"], "#eee");

        expect(after).toContain("// the page background");
    });
});
