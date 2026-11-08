import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeAt, renameKeyAt, setAt } from "../src/text.js";

const colorJson = () => readFileSync(join(import.meta.dirname, "fixtures/demo/color.json"), "utf8");

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

    it("refuses a name a sibling already has, rather than write the key twice", () => {
        expect(renameKeyAt(colorJson(), ["color", "brand"], "neutral")).toBeUndefined();
    });

    it("says so when the path is an item in a list, which has no key", () => {
        const stops = '{ "stops": [{ "position": 0 }, { "position": 1 }] }';

        expect(renameKeyAt(stops, ["stops", 1], "x")).toBeUndefined();
    });
});

describe("setAt and removeAt", () => {
    it("changes one value and nothing else", () => {
        const before = colorJson();
        const after = setAt(before, ["color", "brand", "500", "$value"], "#ff0000") as string;

        expect(JSON.parse(after).color.brand["500"].$value).toBe("#ff0000");
        expect(JSON.parse(after).color.brand["500"].$description).toBe(
            JSON.parse(before).color.brand["500"].$description,
        );
    });

    it("creates the nesting a new token needs", () => {
        const after = JSON.parse(
            setAt(colorJson(), ["color", "raw", "blue"], {
                $type: "color",
                $value: "#00f",
            }) as string,
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

describe("indentation", () => {
    it("writes into the demo's two-space file with two spaces", () => {
        const after = setAt(colorJson(), ["color", "raw"], { $value: "#000" });

        expect(after).toContain('\n    "raw"');
    });

    it("writes into a four-space file with four spaces, and a tab-indented one with tabs", () => {
        const fourSpaces = '{\n    "color": {\n        "bg": { "$value": "#fff" }\n    }\n}';
        const tabs = '{\n\t"color": {\n\t\t"bg": { "$value": "#fff" }\n\t}\n}';

        expect(setAt(fourSpaces, ["color", "fg"], { $value: "#000" })).toContain('\n        "fg"');
        expect(setAt(tabs, ["color", "fg"], { $value: "#000" })).toContain('\n\t\t"fg"');
    });

    it("takes the most common step when a file is inconsistent", () => {
        const mostlyTwo = '{\n  "a": 1,\n  "b": {\n    "c": 1,\n        "d": 2\n  }\n}';

        expect(setAt(mostlyTwo, ["f"], { g: 1 })).toContain('"f": {\n    "g": 1\n  }');
    });

    it("keeps comments a plain rewrite would lose", () => {
        const source = '{\n  // the page background\n  "bg": { "$value": "#fff" }\n}';
        const after = setAt(source, ["bg", "$value"], "#eee");

        expect(after).toContain("// the page background");
    });
});

const oneLineTokens = `{
    // brand colours
    "color": {
        "$type": "color",
        "brand": { "$value": "#3884f2", "$description": "The house colour." },
        "neutral": { "$value": "#737373" },
        "text": { "$value": "{color.brand}" }
    }
}`;

const without = (text: string, line: string) =>
    text
        .split("\n")
        .filter((each) => each !== line)
        .join("\n");

describe("adding leaves every other token's text as written", () => {
    it("writes a new token on one line after a sibling written on one line", () => {
        const after = setAt(oneLineTokens, ["color", "accent"], { $value: "#f59e0b" });

        expect(after).toBe(
            oneLineTokens.replace(
                '"text": { "$value": "{color.brand}" }',
                '"text": { "$value": "{color.brand}" },\n        "accent": { "$value": "#f59e0b" }',
            ),
        );
    });

    it("makes the groups a new token needs, in the same style", () => {
        const after = setAt(oneLineTokens, ["color", "accent", "500"], { $value: "#f59e0b" });

        expect(after).toBe(
            oneLineTokens.replace(
                '"text": { "$value": "{color.brand}" }',
                '"text": { "$value": "{color.brand}" },\n        "accent": { "500": { "$value": "#f59e0b" } }',
            ),
        );
    });

    it("writes a new token over several lines after a sibling written over several", () => {
        const before = '{\n  "a": {\n    "$value": 1\n  }\n}';

        expect(setAt(before, ["b"], { $value: 2 })).toBe(
            '{\n  "a": {\n    "$value": 1\n  },\n  "b": {\n    "$value": 2\n  }\n}',
        );
    });

    it("keeps a comment at the end of the sibling's line on that line", () => {
        const before = '{\n  "a": 1 // the first\n}';

        expect(setAt(before, ["b"], 2)).toBe('{\n  "a": 1, // the first\n  "b": 2\n}');
    });

    it("adds into a group written on one line", () => {
        const before = '{ "a": { "x": 1 } }';

        expect(setAt(before, ["a", "y"], 2)).toBe('{ "a": { "x": 1, "y": 2 } }');
    });

    it("adds into an empty group", () => {
        const before = '{\n  "a": {}\n}';

        expect(setAt(before, ["a", "b"], { $value: 1 })).toBe(
            '{\n  "a": {\n    "b": {\n      "$value": 1\n    }\n  }\n}',
        );
    });
});

describe("replacing leaves every other token's text as written", () => {
    it("keeps a value written on one line on one line", () => {
        const after = setAt(oneLineTokens, ["color", "brand", "$value"], {
            colorSpace: "srgb",
            components: [1, 0, 0],
        });

        expect(after).toBe(
            oneLineTokens.replace(
                '"$value": "#3884f2"',
                '"$value": { "colorSpace": "srgb", "components": [1, 0, 0] }',
            ),
        );
    });

    it("replaces an item in a list", () => {
        const before = '{ "stops": [{ "color": "{a}" }, { "color": "{b}" }] }';

        expect(setAt(before, ["stops", 1, "color"], "{c}")).toBe(
            '{ "stops": [{ "color": "{a}" }, { "color": "{c}" }] }',
        );
    });
});

describe("a file written with trailing commas keeps them", () => {
    it("adds after a last member that has one, giving the new member one too", () => {
        expect(setAt('{\n  "a": 1,\n}', ["b"], 2)).toBe('{\n  "a": 1,\n  "b": 2,\n}');
        expect(setAt('{ "a": 1, }', ["b"], 2)).toBe('{ "a": 1, "b": 2, }');
    });

    it("removes the last member and leaves the one before it with its comma", () => {
        const before = '{\n  "a": 1,\n  "b": 2,\n}';

        expect(removeAt(before, ["b"])).toBe('{\n  "a": 1,\n}');
        expect(removeAt('{ "a": 1, "b": 2, }', ["b"])).toBe('{ "a": 1, }');
    });

    it("leaves an empty group as {} when its only member goes, comma and all", () => {
        expect(removeAt('{ "a": { "x": 1, } }', ["a", "x"])).toBe('{ "a": {} }');
        expect(removeAt('{\n  "a": {\n    "x": 1,\n  }\n}', ["a", "x"])).toBe('{\n  "a": {}\n}');
    });
});

describe("what setAt can't write", () => {
    it("says so when the path runs through a value that isn't a group", () => {
        expect(setAt(oneLineTokens, ["color", "brand", "$value", "hex"], "#fff")).toBeUndefined();
    });

    it("says so when the path ends past the end of a list", () => {
        const before = '{ "stops": [{ "color": "{a}" }] }';

        expect(setAt(before, ["stops", 3], { color: "{b}" })).toBeUndefined();
    });
});

describe("removing leaves every other token's text as written", () => {
    it("takes out a token's line, and only that", () => {
        const line = '        "neutral": { "$value": "#737373" },';

        expect(removeAt(oneLineTokens, ["color", "neutral"])).toBe(without(oneLineTokens, line));
    });

    it("takes the comma off the token before, when the last one goes", () => {
        const after = removeAt(oneLineTokens, ["color", "text"]);

        expect(after).toBe(
            without(oneLineTokens, '        "text": { "$value": "{color.brand}" }').replace(
                '"neutral": { "$value": "#737373" },',
                '"neutral": { "$value": "#737373" }',
            ),
        );
    });

    it("keeps a comment about the next token", () => {
        const before = '{\n  "a": 1,\n  // about b\n  "b": 2\n}';

        expect(removeAt(before, ["a"])).toBe('{\n  // about b\n  "b": 2\n}');
    });

    it("takes a token out of a group written on one line", () => {
        expect(removeAt('{ "a": 1, "b": 2, "c": 3 }', ["b"])).toBe('{ "a": 1, "c": 3 }');
        expect(removeAt('{ "a": 1, "b": 2 }', ["b"])).toBe('{ "a": 1 }');
    });

    it("leaves an empty group as {}", () => {
        expect(removeAt('{\n  "a": {\n    "b": 1\n  }\n}', ["a", "b"])).toBe('{\n  "a": {}\n}');
    });

    it("hands back the same text when the path is not there", () => {
        expect(removeAt(oneLineTokens, ["color", "nope"])).toBe(oneLineTokens);
    });

    it("keeps a comment in a group whose last token goes", () => {
        const before = '{\n  "a": {\n    // note\n    "b": 1\n  }\n}';

        expect(removeAt(before, ["a", "b"])).toBe('{\n  "a": {\n    // note\n  }\n}');
    });

    it("takes the comments written about an item in a one-line list with it", () => {
        const before = "[1 /* a */, /* b */ 2 /* c */, /* d */ true]";

        expect(removeAt(before, [1])).toBe("[1 /* a */, /* d */ true]");
    });
});

describe("files written on Windows", () => {
    const crlf = (text: string) => text.replaceAll("\n", "\r\n");

    it("adds a token with the file's own line endings", () => {
        const before = crlf('{\n  "a": {\n    "$value": 1\n  }\n}');

        expect(setAt(before, ["b"], { $value: 2 })).toBe(
            crlf('{\n  "a": {\n    "$value": 1\n  },\n  "b": {\n    "$value": 2\n  }\n}'),
        );
    });

    it("adds into an empty group with the file's own line endings", () => {
        expect(setAt(crlf('{\n  "a": {}\n}'), ["a", "b"], 1)).toBe(
            crlf('{\n  "a": {\n    "b": 1\n  }\n}'),
        );
    });

    it("changes a value written over several lines with the file's own line endings", () => {
        const before = crlf('{\n  "a": {\n    "x": 1\n  }\n}');

        expect(setAt(before, ["a"], { y: 2 })).toBe(crlf('{\n  "a": {\n    "y": 2\n  }\n}'));
    });

    it("removes a token and its line ending together", () => {
        const before = crlf('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}');

        expect(removeAt(before, ["b"])).toBe(crlf('{\n  "a": 1,\n  "c": 3\n}'));
        expect(removeAt(before, ["c"])).toBe(crlf('{\n  "a": 1,\n  "b": 2\n}'));
    });
});

describe("what the file holds besides tokens", () => {
    it("keeps a comment in an empty group when adding into it", () => {
        const before = '{\n  "a": {\n    // note\n  }\n}';

        expect(setAt(before, ["a", "b"], 1)).toBe('{\n  "a": {\n    // note\n    "b": 1\n  }\n}');
    });

    it("keeps a byte order mark at the start of the file", () => {
        const before = '﻿{\n  "a": 1\n}';

        expect(setAt(before, ["b"], 2)).toBe('﻿{\n  "a": 1,\n  "b": 2\n}');
        expect(removeAt(before, ["a"])).toBe("﻿{}");
    });
});
