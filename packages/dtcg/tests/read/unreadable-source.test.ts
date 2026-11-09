import { describe, expect, it } from "vitest";
import { type DesignTokens, readFromMemory } from "../../src/index.js";
import { lightDark } from "../token-files.js";

const colors = JSON.stringify(
    {
        color: {
            $type: "color",
            red: { $value: { colorSpace: "srgb", components: [1, 0, 0] } },
            blue: { $value: { colorSpace: "srgb", components: [0, 0, 1] } },
            green: { $value: { colorSpace: "srgb", components: [0, 1, 0] } },
        },
    },
    null,
    2,
);
const cutShort = colors.slice(0, Math.floor(colors.length / 2));

const roles = JSON.stringify({
    role: {
        $type: "color",
        text: { $value: "{color.red}" },
        link: { $value: "{color.blue}" },
        typo: { $value: "{color.gren}" },
    },
});

const kinds = (tokens: DesignTokens) => tokens.diagnostics.map(({ kind }) => kind);

describe("a source that can't be read", () => {
    it.for<[string, string[], Record<string, string>, string[]]>([
        [
            "is one problem: references into what it held are not reported as well",
            ["colors.json", "roles.json"],
            { "colors.json": cutShort, "roles.json": roles },
            ["invalid-json"],
        ],
        [
            "is one problem when the file isn't there at all",
            ["colors.json", "roles.json"],
            { "roles.json": roles },
            ["file-not-found"],
        ],
        [
            "quiets a group's $extends into what it held",
            ["colors.json", "brand.json"],
            {
                "colors.json": cutShort,
                "brand.json": JSON.stringify({ brand: { $extends: "{color}" } }),
            },
            ["invalid-json"],
        ],
    ])("%s", ([, base, files, expected]) => {
        const tokens = readFromMemory({
            files: { "tokens.resolver.json": lightDark(base, []), ...files },
        });
        expect(kinds(tokens)).toStrictEqual(expected);
    });

    it("quiets only the permutations that read it: elsewhere a missing reference is reported", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": lightDark(["roles.json"], ["colors.json"]),
                "colors.json": cutShort,
                "roles.json": roles,
            },
        });
        const missing = tokens.diagnostics.filter(({ kind }) => kind === "missing-reference");
        expect(missing.map(({ permutations }) => permutations.label)).toStrictEqual([
            "mode: light",
            "mode: light",
            "mode: light",
        ]);
        expect(kinds(tokens).filter((kind) => kind !== "missing-reference")).toStrictEqual([
            "invalid-json",
        ]);
    });

    it("hides nothing once it reads: a reference that is really missing comes back, with what was meant", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": lightDark(["colors.json", "roles.json"], []),
                "colors.json": colors,
                "roles.json": roles,
            },
        });
        expect(tokens.diagnostics.map(({ message }) => message)).toStrictEqual([
            "`color.gren` does not exist; did you mean `color.green`?",
        ]);
    });
});
