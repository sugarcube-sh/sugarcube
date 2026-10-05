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

function ignored(raw: unknown) {
    const result = parseTypography(raw, ["$value"]);
    return (result.ignored ?? []).map(({ path, detail }) => ({ path, detail }));
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
                    {
                        path: ["$value", part],
                        detail: { type: "typography", reason: "missing-property", property: part },
                    },
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
            ).toStrictEqual([
                {
                    path: ["$value", "letterSpacing"],
                    detail: {
                        type: "typography",
                        reason: "missing-property",
                        property: "letterSpacing",
                    },
                },
            ]);
        });

        it("a line height with a unit, since spec 9.8 makes it a number", () => {
            expect(details({ ...heading, lineHeight: px(24) })).toStrictEqual([
                {
                    path: ["$value", "lineHeight"],
                    detail: { type: "number", reason: "not-a-number", value: px(24) },
                },
            ]);
        });

        it.for(["16px Roboto", null, [heading]])("%j, which is not a typography value", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "typography", reason: "wrong-shape", value: raw },
                },
            ]);
        });

        it("each bad part, with its own parser's reason, at its full path", () => {
            expect(
                details({ ...heading, fontFamily: [], fontSize: "42px", fontWeight: "Bold" }),
            ).toStrictEqual([
                {
                    path: ["$value", "fontFamily"],
                    detail: { type: "fontFamily", reason: "empty-font-list" },
                },
                {
                    path: ["$value", "fontSize"],
                    detail: { type: "dimension", reason: "string-with-unit", value: "42px" },
                },
                {
                    path: ["$value", "fontWeight"],
                    detail: {
                        type: "fontWeight",
                        reason: "unknown-font-weight-keyword",
                        value: "Bold",
                    },
                },
            ]);
        });
    });

    describe("sets aside a property its type does not define, and reads the rest", () => {
        it.for(["paragraphSpacing", "fontStyle", "textTransform", "textDecoration"])(
            "not %s, which spec 9.8 does not define: it is set aside and the rest read",
            (part) => {
                const raw = { ...heading, [part]: "italic" };
                expect(read(raw)).toStrictEqual(read(heading));
                expect(ignored(raw)).toStrictEqual([
                    { path: ["$value", part], detail: { type: "typography", property: part } },
                ]);
            },
        );

        it("a part missing, with a part set aside beside it", () => {
            const { lineHeight: _, ...partial } = heading;
            const raw = { ...partial, paragraphSpacing: px(8) };
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value", "lineHeight"],
                    detail: {
                        type: "typography",
                        reason: "missing-property",
                        property: "lineHeight",
                    },
                },
            ]);
            expect(ignored(raw)).toStrictEqual([
                {
                    path: ["$value", "paragraphSpacing"],
                    detail: { type: "typography", property: "paragraphSpacing" },
                },
            ]);
        });
    });
});
