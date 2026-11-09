import { describe, expect, it } from "vitest";
import { mistakesIn } from "./config-mistakes.js";

const issues = (classes: unknown): string[] => mistakesIn({ utilities: { classes } });

describe("utility classes", () => {
    it("accepts a source ending in .*, and one with no wildcard", () => {
        expect(
            issues({
                "color": { source: "color.*", prefix: "text" },
                "font-weight": { source: "font.weight.*" },
                "--accent": { source: "color.brand", prefix: "accent" },
            }),
        ).toStrictEqual([]);
    });

    it("refuses a wildcard anywhere but the end, naming the property", () => {
        expect(issues({ color: { source: "color.*.bg", prefix: "text" } })).toStrictEqual([
            '`utilities.classes.color.source` can have `*` only at the end, such as "color.*", not "color.*.bg"',
        ]);
        expect(
            issues({
                margin: [
                    { source: "space.*", prefix: "m" },
                    { source: "space*", prefix: "m" },
                ],
            }),
        ).toStrictEqual([
            '`utilities.classes.margin.1.source` can have `*` only at the end, such as "color.*", not "space*"',
        ]);
    });

    it("refuses an empty source, naming the property", () => {
        expect(issues({ "background-color": { source: "", prefix: "bg" } })).toStrictEqual([
            '`utilities.classes.background-color.source` is empty: name the group its tokens come from, such as "color.*"',
        ]);
    });
});
