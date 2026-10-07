import { describe, expect, it } from "vitest";
import type { ParseOptions } from "../../src/index.js";
import { lineCaps, parseStrokeStyle, strokeStyleKeywords } from "../../src/values.js";

const lenient: ParseOptions = { ignoreUnknownProperties: true };

function read(raw: unknown, options?: ParseOptions) {
    const result = parseStrokeStyle(raw, ["$value"], options);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown, options?: ParseOptions) {
    const result = parseStrokeStyle(raw, ["$value"], options);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

function ignored(raw: unknown, options?: ParseOptions) {
    const result = parseStrokeStyle(raw, ["$value"], options);
    return result.ignored.map(({ path, detail }) => ({ path, detail }));
}

const px = (value: number) => ({ value, unit: "px" });

describe("parseStrokeStyle", () => {
    describe("reads", () => {
        it.for([...strokeStyleKeywords])("the keyword %s", (keyword) => {
            expect(read(keyword)).toStrictEqual({ kind: "keyword", keyword });
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
                kind: "dash",
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
                kind: "dash",
                dashArray: [{ alias: "dash-length-medium" }, px(4)],
                lineCap: "butt",
            });
        });

        it("a single length, which the spec says repeats", () => {
            expect(read({ dashArray: [px(4)], lineCap: "square" })).toMatchObject({
                dashArray: [px(4)],
            });
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{border.style.focus}")).toStrictEqual({ alias: "border.style.focus" });
        });

        it.for(["dashArray", "lineCap"])("reads a JSON Pointer in place of %s", (part) => {
            const raw = { dashArray: [px(4)], lineCap: "round", [part]: { $ref: "#/elsewhere" } };
            expect(read(raw)).toMatchObject({ [part]: { pointer: "#/elsewhere" } });
        });
    });

    describe("refuses", () => {
        it.for([
            ["lineCap", { dashArray: [px(4)], lineCap: "{stroke.cap}" }],
            ["dashArray", { dashArray: "{stroke.cap}", lineCap: "round" }],
        ] as const)(
            "a curly-brace reference as the %s, where a JSON Pointer can stand",
            ([part, raw]) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value", part],
                        detail: {
                            type: "strokeStyle",
                            reason: "alias-not-allowed-here",
                            reference: "{stroke.cap}",
                        },
                    },
                ]);
            },
        );

        it.for(["Solid", "none", "hidden", "wavy", ""])(
            "the string %j, which is not a keyword",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: {
                            type: "strokeStyle",
                            reason: "unknown-stroke-style-keyword",
                            value: raw,
                            keywords: strokeStyleKeywords,
                        },
                    },
                ]);
            },
        );

        it.for([42, null, true, ["solid"]])("%j, which is not a stroke style", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "strokeStyle", reason: "wrong-shape", value: raw },
                },
            ]);
        });

        it("a dash pattern with neither part", () => {
            expect(details({})).toStrictEqual([
                {
                    path: ["$value", "dashArray"],
                    detail: {
                        type: "strokeStyle",
                        reason: "missing-property",
                        property: "dashArray",
                    },
                },
                {
                    path: ["$value", "lineCap"],
                    detail: {
                        type: "strokeStyle",
                        reason: "missing-property",
                        property: "lineCap",
                    },
                },
            ]);
        });

        it("a dashArray that is not a list", () => {
            expect(details({ dashArray: px(4), lineCap: "round" })).toStrictEqual([
                {
                    path: ["$value", "dashArray"],
                    detail: { type: "strokeStyle", reason: "dash-array-not-a-list", value: px(4) },
                },
            ]);
        });

        it("an empty dashArray", () => {
            expect(details({ dashArray: [], lineCap: "round" })).toStrictEqual([
                {
                    path: ["$value", "dashArray"],
                    detail: { type: "strokeStyle", reason: "empty-dash-array" },
                },
            ]);
        });

        it("each bad length in a dashArray, where it is, with the dimension parser's own reason", () => {
            expect(
                details({ dashArray: [px(4), "4px", { value: 2, unit: "em" }], lineCap: "round" }),
            ).toStrictEqual([
                {
                    path: ["$value", "dashArray", 1],
                    detail: {
                        type: "dimension",
                        reason: "string-with-unit",
                        value: "4px",
                        asObject: { value: 4, unit: "px" },
                    },
                },
                {
                    path: ["$value", "dashArray", 2, "unit"],
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
            expect(details({ dashArray: [px(4)], lineCap })).toStrictEqual([
                {
                    path: ["$value", "lineCap"],
                    detail: {
                        type: "strokeStyle",
                        reason: "unknown-line-cap",
                        value: lineCap,
                        lineCaps: lineCaps,
                    },
                },
            ]);
        });
    });

    describe("a property its type does not define", () => {
        it("makes the value invalid by default, as Format 9.2 says of a composite", () => {
            const raw = { dashArray: [px(4)], lineCap: "round", dashOffset: px(1) };
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value", "dashOffset"],
                    detail: {
                        type: "strokeStyle",
                        reason: "unknown-property",
                        property: "dashOffset",
                    },
                },
            ]);
            expect(ignored(raw)).toStrictEqual([]);
        });

        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a property the spec does not define", () => {
                const raw = { dashArray: [px(4)], lineCap: "round", dashOffset: px(1) };
                expect(read(raw, lenient)).toStrictEqual({
                    kind: "dash",
                    dashArray: [px(4)],
                    lineCap: "round",
                });
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        path: ["$value", "dashOffset"],
                        detail: { type: "strokeStyle", property: "dashOffset" },
                    },
                ]);
            });

            it("a length's own property, at its full path", () => {
                const raw = { dashArray: [{ ...px(4), fluid: true }], lineCap: "round" };
                expect(read(raw, lenient)).toStrictEqual({
                    kind: "dash",
                    dashArray: [px(4)],
                    lineCap: "round",
                });
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        path: ["$value", "dashArray", 0, "fluid"],
                        detail: { type: "dimension", property: "fluid" },
                    },
                ]);
            });
        });
    });
});
