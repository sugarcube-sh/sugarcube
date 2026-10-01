import { describe, expect, it } from "vitest";
import { fontWeightKeywords, parseFontWeight } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseFontWeight(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseFontWeight(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

describe("parseFontWeight", () => {
    describe("reads", () => {
        it.for([1, 350, 400, 1000, 450.5])("the number %s", (weight) => {
            expect(read(weight)).toBe(weight);
        });

        it.for(Object.entries(fontWeightKeywords))("the keyword %s as %s", ([keyword, weight]) => {
            expect(read(keyword)).toBe(weight);
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{font.weight.normal}")).toStrictEqual({ alias: "font.weight.normal" });
        });

        it("reads a JSON Pointer as the whole value", () => {
            expect(read({ $ref: "#/font/weight/bold/$value" })).toStrictEqual({
                pointer: "#/font/weight/bold/$value",
            });
        });
    });

    describe("refuses", () => {
        it.for([0, 1001, -100])("%s, outside 1 to 1000", (weight) => {
            expect(details(weight)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: {
                        type: "fontWeight",
                        reason: "font-weight-out-of-range",
                        value: weight,
                    },
                },
            ]);
        });

        it.for(["Bold", "BOLD", "semibold", "700", "extra bold"])(
            "%j, which is not a keyword the spec defines, since keywords are case-sensitive",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: {
                            type: "fontWeight",
                            reason: "unknown-font-weight-keyword",
                            value: raw,
                        },
                    },
                ]);
            },
        );

        it.for([null, true, [700], { weight: 700 }])("%j, which is not a weight", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "fontWeight", reason: "wrong-shape", value: raw },
                },
            ]);
        });
    });
});
