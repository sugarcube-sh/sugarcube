import { describe, expect, it } from "vitest";
import { parseStrokeStyle, strokeStyleKeywords } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseStrokeStyle(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseStrokeStyle(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
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
        it.for(["Solid", "none", "hidden", "wavy", ""])(
            "the string %j, which is not a keyword",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    { path: ["$value"], detail: "unknown-stroke-style-keyword" },
                ]);
            },
        );

        it.for([42, null, true, ["solid"]])("%j, which is not a stroke style", (raw) => {
            expect(details(raw)).toStrictEqual([{ path: ["$value"], detail: "wrong-shape" }]);
        });

        it("a dash pattern with neither part", () => {
            expect(details({})).toStrictEqual([
                { path: ["$value"], detail: "missing-property" },
                { path: ["$value"], detail: "missing-property" },
            ]);
        });

        it("a dashArray that is not a list", () => {
            expect(details({ dashArray: px(4), lineCap: "round" })).toStrictEqual([
                { path: ["$value", "dashArray"], detail: "dash-array-not-a-list" },
            ]);
        });

        it("an empty dashArray", () => {
            expect(details({ dashArray: [], lineCap: "round" })).toStrictEqual([
                { path: ["$value", "dashArray"], detail: "empty-dash-array" },
            ]);
        });

        it("each bad length in a dashArray, where it is, with the dimension parser's own reason", () => {
            expect(
                details({ dashArray: [px(4), "4px", { value: 2, unit: "em" }], lineCap: "round" }),
            ).toStrictEqual([
                { path: ["$value", "dashArray", 1], detail: "string-with-unit" },
                { path: ["$value", "dashArray", 2, "unit"], detail: "unit-not-allowed" },
            ]);
        });

        it.for(["Round", "flat", 1])("the line cap %j", (lineCap) => {
            expect(details({ dashArray: [px(4)], lineCap })).toStrictEqual([
                { path: ["$value", "lineCap"], detail: "unknown-line-cap" },
            ]);
        });

        it("a property the spec does not define", () => {
            expect(
                details({ dashArray: [px(4)], lineCap: "round", dashOffset: px(1) }),
            ).toStrictEqual([{ path: ["$value", "dashOffset"], detail: "unknown-property" }]);
        });
    });
});
