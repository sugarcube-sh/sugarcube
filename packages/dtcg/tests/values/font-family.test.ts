import { describe, expect, it } from "vitest";
import { parseValue } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseValue("fontFamily", raw, { jsonPath: ["$value"] });
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseValue("fontFamily", raw, { jsonPath: ["$value"] });
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ jsonPath, detail }) => ({ jsonPath, detail }));
}

describe("parseValue, fontFamily", () => {
    describe("reads", () => {
        it("one name as a list of one", () => {
            expect(read("Comic Sans MS")).toStrictEqual(["Comic Sans MS"]);
        });

        it("a list of names, in order", () => {
            expect(read(["Helvetica", "Arial", "sans-serif"])).toStrictEqual([
                "Helvetica",
                "Arial",
                "sans-serif",
            ]);
        });

        it("a name with a comma in it as one name, since it is written as one string", () => {
            expect(read("Arial, sans-serif")).toStrictEqual(["Arial, sans-serif"]);
        });

        it("reads a reference to a whole token in curly brace syntax", () => {
            expect(read("{font.serif}")).toStrictEqual({
                syntax: "curly-brace",
                path: "font.serif",
            });
        });

        it("reads a JSON Pointer in place of one name", () => {
            expect(read([{ $ref: "#/font/brand/$value/0" }, "sans-serif"])).toStrictEqual([
                { syntax: "json-pointer", pointer: "#/font/brand/$value/0" },
                "sans-serif",
            ]);
        });
    });

    describe("refuses", () => {
        it.for(["", "   "])("the empty name %j", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    jsonPath: ["$value"],
                    detail: { type: "fontFamily", reason: "not-a-font-name", value: raw },
                },
            ]);
        });

        it("an empty list", () => {
            expect(details([])).toStrictEqual([
                { jsonPath: ["$value"], detail: { type: "fontFamily", reason: "empty-font-list" } },
            ]);
        });

        it("a list with something other than a name in it", () => {
            expect(details(["Arial", 42, ""])).toStrictEqual([
                {
                    jsonPath: ["$value", 1],
                    detail: { type: "fontFamily", reason: "not-a-font-name", value: 42 },
                },
                {
                    jsonPath: ["$value", 2],
                    detail: { type: "fontFamily", reason: "not-a-font-name", value: "" },
                },
            ]);
        });

        it("a curly-brace reference in place of one name, rather than reading it as a font's name", () => {
            expect(details(["{font.brand}", "serif"])).toStrictEqual([
                {
                    jsonPath: ["$value", 0],
                    detail: {
                        type: "fontFamily",
                        reason: "curly-brace-not-allowed-here",
                        reference: "{font.brand}",
                    },
                },
            ]);
        });

        it.for([42, null, true, { name: "Arial" }])("%j, which is not a name or a list", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    jsonPath: ["$value"],
                    detail: { type: "fontFamily", reason: "wrong-shape", value: raw },
                },
            ]);
        });
    });
});
