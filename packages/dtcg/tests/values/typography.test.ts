import { describe, expect, it } from "vitest";
import { parseTypography } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseTypography(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseTypography(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

const px = (value: number) => ({ value, unit: "px" });
const heading = {
    fontFamily: "Roboto",
    fontSize: px(42),
    fontWeight: 700,
    letterSpacing: px(0.1),
    lineHeight: 1.2,
};

describe("parseTypography", () => {
    describe("reads", () => {
        it("heading-level-1 from spec example 58, with each part in its own shape", () => {
            expect(read(heading)).toStrictEqual({ ...heading, fontFamily: ["Roboto"] });
        });

        it("microcopy from spec example 58, with references for three parts", () => {
            expect(
                read({
                    fontFamily: "{font.serif}",
                    fontSize: "{font.size.smallest}",
                    fontWeight: "{font.weight.normal}",
                    letterSpacing: px(0),
                    lineHeight: 1,
                }),
            ).toStrictEqual({
                fontFamily: { alias: "font.serif" },
                fontSize: { alias: "font.size.smallest" },
                fontWeight: { alias: "font.weight.normal" },
                letterSpacing: px(0),
                lineHeight: 1,
            });
        });

        it("a keyword font weight as its number", () => {
            expect(read({ ...heading, fontWeight: "semi-bold" })).toMatchObject({
                fontWeight: 600,
            });
        });

        it("JSON Pointers in place of parts, as spec example 37 does", () => {
            expect(
                read({
                    ...heading,
                    fontFamily: { $ref: "#/base/text/$value/fontFamily" },
                    lineHeight: { $ref: "#/base/text/$value/lineHeight" },
                }),
            ).toMatchObject({
                fontFamily: { pointer: "#/base/text/$value/fontFamily" },
                lineHeight: { pointer: "#/base/text/$value/lineHeight" },
            });
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{type.heading}")).toStrictEqual({ alias: "type.heading" });
        });
    });

    describe("refuses", () => {
        it.for(["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"])(
            "a typography value with no %s, since spec 9.8 requires all five",
            (part) => {
                const raw: Record<string, unknown> = { ...heading };
                delete raw[part];
                expect(details(raw)).toStrictEqual([
                    { path: ["$value", part], detail: "missing-property" },
                ]);
            },
        );

        it("spec example 37 as printed, which leaves out letterSpacing, since 9.8 is the rule and examples are not", () => {
            expect(
                details({
                    fontFamily: ["Helvetica", "Arial", "sans-serif"],
                    fontSize: px(16),
                    fontWeight: 400,
                    lineHeight: 1.5,
                }),
            ).toStrictEqual([{ path: ["$value", "letterSpacing"], detail: "missing-property" }]);
        });

        it.for(["fontStyle", "textTransform", "textDecoration"])(
            "the part %s, which spec 9.8 does not define",
            (part) => {
                expect(details({ ...heading, [part]: "italic" })).toStrictEqual([
                    { path: ["$value", part], detail: "unknown-property" },
                ]);
            },
        );

        it("a line height with a unit, since spec 9.8 makes it a number", () => {
            expect(details({ ...heading, lineHeight: px(24) })).toStrictEqual([
                { path: ["$value", "lineHeight"], detail: "wrong-shape" },
            ]);
        });

        it.for(["16px Roboto", null, [heading]])("%j, which is not a typography value", (raw) => {
            expect(details(raw)).toStrictEqual([{ path: ["$value"], detail: "wrong-shape" }]);
        });

        it("each bad part, with its own parser's reason, at its full path", () => {
            expect(
                details({ ...heading, fontFamily: [], fontSize: "42px", fontWeight: "Bold" }),
            ).toStrictEqual([
                { path: ["$value", "fontFamily"], detail: "empty-font-list" },
                { path: ["$value", "fontSize"], detail: "string-with-unit" },
                { path: ["$value", "fontWeight"], detail: "unknown-font-weight-keyword" },
            ]);
        });
    });
});
