import { describe, expect, it } from "vitest";
import { lenient, parsing } from "./parsing.js";

const { read, ignored, reasons, refuses } = parsing("typography");

const px = (value: number) => ({ value, unit: "px" });
const heading = {
    fontFamily: "Roboto",
    fontSize: px(42),
    fontWeight: 700,
    letterSpacing: px(0.1),
    lineHeight: 1.2,
};

describe("parseValue, typography", () => {
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
                fontFamily: { syntax: "curly-brace", path: "font.serif" },
                fontSize: { syntax: "curly-brace", path: "font.size.smallest" },
                fontWeight: { syntax: "curly-brace", path: "font.weight.normal" },
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
                fontFamily: { syntax: "json-pointer", pointer: "#/base/text/$value/fontFamily" },
                lineHeight: { syntax: "json-pointer", pointer: "#/base/text/$value/lineHeight" },
            });
        });
    });

    describe("refuses", () => {
        it.for(["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"])(
            "a typography value with no %s, since spec 9.8 requires all five",
            (part) => {
                const raw: Record<string, unknown> = { ...heading };
                delete raw[part];
                refuses(raw, [part], { reason: "missing-property", property: part });
            },
        );

        it("spec example 37 as printed, which leaves out letterSpacing, since 9.8 is the rule and examples are not", () => {
            refuses(
                {
                    fontFamily: ["Helvetica", "Arial", "sans-serif"],
                    fontSize: px(16),
                    fontWeight: 400,
                    lineHeight: 1.5,
                },
                ["letterSpacing"],
                { reason: "missing-property", property: "letterSpacing" },
            );
        });

        it("a line height with a unit, since spec 9.8 makes it a number", () => {
            refuses({ ...heading, lineHeight: px(24) }, ["lineHeight"], {
                type: "number",
                reason: "not-a-number",
                value: px(24),
            });
        });

        it.for(["16px Roboto", null, [heading]])("%j, which is not a typography value", (raw) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });

        it("each bad part, with its own parser's reason, at its full path", () => {
            const raw = { ...heading, fontFamily: [], fontSize: "42px", fontWeight: "Bold" };
            expect(reasons(raw)).toStrictEqual([
                [["$value", "fontFamily"], "fontFamily", "empty-font-list"],
                [["$value", "fontSize"], "dimension", "string-with-unit"],
                [["$value", "fontWeight"], "fontWeight", "unknown-font-weight-keyword"],
            ]);
        });
    });

    describe("a property its type does not define", () => {
        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it.for(["paragraphSpacing", "fontStyle", "textTransform", "textDecoration"])(
                "not %s, which spec 9.8 does not define: it is set aside and the rest read",
                (part) => {
                    const raw = { ...heading, [part]: "italic" };
                    expect(read(raw, lenient)).toStrictEqual(read(heading, lenient));
                    expect(ignored(raw, lenient)).toStrictEqual([
                        {
                            jsonPath: ["$value", part],
                            detail: { type: "typography", property: part },
                        },
                    ]);
                },
            );

            it("a part missing, with a part set aside beside it", () => {
                const { lineHeight: _, ...partial } = heading;
                const raw = { ...partial, paragraphSpacing: px(8) };
                refuses(
                    raw,
                    ["lineHeight"],
                    { reason: "missing-property", property: "lineHeight" },
                    lenient,
                );
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", "paragraphSpacing"],
                        detail: { type: "typography", property: "paragraphSpacing" },
                    },
                ]);
            });
        });
    });
});
