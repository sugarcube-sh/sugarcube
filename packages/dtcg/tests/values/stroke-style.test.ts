import { describe, expect, it } from "vitest";
import { lineCaps, strokeStyleKeywords } from "../../src/values.js";
import { lenient, parsing } from "./parsing.js";

const { read, details, ignored, refuses } = parsing("strokeStyle");

const px = (value: number) => ({ value, unit: "px" });

describe("parseValue, strokeStyle", () => {
    describe("reads", () => {
        it.for([...strokeStyleKeywords])("the keyword %s", (keyword) => {
            expect(read(keyword)).toStrictEqual(keyword);
        });

        it("a dash pattern, as spec example 48 writes it", () => {
            expect(
                read({
                    dashArray: [
                        { value: 0.5, unit: "rem" },
                        { value: 0.25, unit: "rem" },
                    ],
                    lineCap: "round",
                }),
            ).toStrictEqual({
                dashArray: [
                    { value: 0.5, unit: "rem" },
                    { value: 0.25, unit: "rem" },
                ],
                lineCap: "round",
            });
        });

        it("references to dimension tokens inside a dash pattern, as spec example 49 does", () => {
            expect(
                read({ dashArray: ["{dash-length-medium}", px(4)], lineCap: "butt" }),
            ).toStrictEqual({
                dashArray: [{ syntax: "curly-brace", path: "dash-length-medium" }, px(4)],
                lineCap: "butt",
            });
        });

        it("a single length, which the spec says repeats", () => {
            expect(read({ dashArray: [px(4)], lineCap: "square" })).toMatchObject({
                dashArray: [px(4)],
            });
        });

        it.for(["dashArray", "lineCap"])("reads a JSON Pointer in place of %s", (part) => {
            const raw = { dashArray: [px(4)], lineCap: "round", [part]: { $ref: "#/elsewhere" } };
            expect(read(raw)).toMatchObject({
                [part]: { syntax: "json-pointer", pointer: "#/elsewhere" },
            });
        });
    });

    describe("refuses", () => {
        it.for([
            ["lineCap", { dashArray: [px(4)], lineCap: "{stroke.cap}" }],
            ["dashArray", { dashArray: "{stroke.cap}", lineCap: "round" }],
        ] as const)(
            "a curly-brace reference as the %s, where a JSON Pointer can stand",
            ([part, raw]) => {
                refuses(raw, [part], {
                    reason: "curly-brace-not-allowed-here",
                    reference: "{stroke.cap}",
                });
            },
        );

        it.for(["Solid", "none", "hidden", "wavy", ""])(
            "the string %j, which is not a keyword",
            (raw) => {
                refuses(raw, [], {
                    reason: "unknown-stroke-style-keyword",
                    value: raw,
                    keywords: strokeStyleKeywords,
                });
            },
        );

        it.for([42, null, true, ["solid"]])("%j, which is not a stroke style", (raw) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });

        it("a dash pattern with neither part", () => {
            expect(details({})).toStrictEqual([
                {
                    jsonPath: ["$value", "dashArray"],
                    detail: {
                        type: "strokeStyle",
                        reason: "missing-property",
                        property: "dashArray",
                    },
                },
                {
                    jsonPath: ["$value", "lineCap"],
                    detail: {
                        type: "strokeStyle",
                        reason: "missing-property",
                        property: "lineCap",
                    },
                },
            ]);
        });

        it("a dashArray that is not a list", () => {
            refuses({ dashArray: px(4), lineCap: "round" }, ["dashArray"], {
                reason: "dash-array-not-a-list",
                value: px(4),
            });
        });

        it("an empty dashArray", () => {
            refuses({ dashArray: [], lineCap: "round" }, ["dashArray"], {
                reason: "empty-dash-array",
            });
        });

        it("each bad length in a dashArray, where it is, with the dimension parser's own reason", () => {
            expect(
                details({ dashArray: [px(4), "4px", { value: 2, unit: "em" }], lineCap: "round" }),
            ).toStrictEqual([
                {
                    jsonPath: ["$value", "dashArray", 1],
                    detail: {
                        type: "dimension",
                        reason: "string-with-unit",
                        value: "4px",
                        asObject: { value: 4, unit: "px" },
                    },
                },
                {
                    jsonPath: ["$value", "dashArray", 2, "unit"],
                    detail: {
                        type: "dimension",
                        reason: "unit-not-allowed",
                        unit: "em",
                        allowed: ["px", "rem"],
                    },
                },
            ]);
        });

        it.for(["Round", "flat", 1])("the line cap %j", (lineCap) => {
            refuses({ dashArray: [px(4)], lineCap }, ["lineCap"], {
                reason: "unknown-line-cap",
                value: lineCap,
                lineCaps: lineCaps,
            });
        });
    });

    describe("a property its type does not define", () => {
        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a length's own property, at its full path", () => {
                const raw = { dashArray: [{ ...px(4), fluid: true }], lineCap: "round" };
                expect(read(raw, lenient)).toStrictEqual({
                    dashArray: [px(4)],
                    lineCap: "round",
                });
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", "dashArray", 0, "fluid"],
                        detail: { type: "dimension", property: "fluid" },
                    },
                ]);
            });
        });
    });
});
