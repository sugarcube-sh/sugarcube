import { readFromMemory } from "@sugarcube-sh/dtcg";
import { rename, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { toChangeLines, formatChange } from "../../src/controllers/views";
import { createDemoStudio } from "./demo-message";

describe("toChangeLines", () => {
    it("gives a line for each change, naming the theme it is in", () => {
        const studio = createDemoStudio();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", {
                input: { mode: "dark" },
            }),
        );

        expect(toChangeLines(studio.state.changes)).toEqual([
            { kind: "changed", path: "color.text.default", permutationLabel: "mode: dark" },
        ]);
    });

    it("names no theme for a change in every theme", () => {
        const studio = createDemoStudio();
        studio.do(setValue(studio.state.tokens, "radius.md", { value: 0.5, unit: "rem" }));

        expect(toChangeLines(studio.state.changes)).toEqual([
            { kind: "changed", path: "radius.md" },
        ]);
    });

    it("gives a rename once for each theme dtcg reports it in, with where it came from", () => {
        const studio = createDemoStudio();
        studio.do(rename(studio.state.tokens, "color.text.default", "body"));

        expect(toChangeLines(studio.state.changes)).toEqual([
            {
                kind: "renamed",
                from: "color.text.default",
                path: "color.text.body",
                permutationLabel: "mode: light",
            },
            {
                kind: "renamed",
                from: "color.text.default",
                path: "color.text.body",
                permutationLabel: "mode: dark",
            },
        ]);
    });
});

describe("formatChange", () => {
    it("words a change to the top level as the top level, and a group by its path", () => {
        expect(formatChange({ kind: "group-changed", path: "", topLevel: true })).toBe(
            "Top level changed",
        );
        expect(formatChange({ kind: "group-changed", path: "color" })).toBe("`color` changed");
    });
});

describe("toChangeLines, at the top level", () => {
    it('marks a change to the group at "" as the top level\'s', () => {
        const version = (description: string) =>
            readFromMemory({
                files: {
                    "tokens.json": JSON.stringify({
                        $description: description,
                        a: { $type: "number", $value: 1 },
                    }),
                },
            });

        expect(toChangeLines(version("Two").getChangesSince(version("One")))).toEqual([
            { kind: "group-changed", path: "", topLevel: true },
        ]);
    });
});
