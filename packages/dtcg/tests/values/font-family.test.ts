import { describe, expect, it } from "vitest";
import { parseFontFamily } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseFontFamily(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseFontFamily(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

describe("parseFontFamily", () => {
    describe("reads", () => {
        it("one name as a list of one, as contract 01 says", () => {
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

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{font.serif}")).toStrictEqual({ alias: "font.serif" });
        });

        it("reads a JSON Pointer in place of one name", () => {
            expect(read([{ $ref: "#/font/brand/$value/0" }, "sans-serif"])).toStrictEqual([
                { pointer: "#/font/brand/$value/0" },
                "sans-serif",
            ]);
        });
    });

    describe("refuses", () => {
        it.for(["", "   "])("the empty name %j", (raw) => {
            expect(details(raw)).toStrictEqual([{ path: ["$value"], detail: "not-a-font-name" }]);
        });

        it("an empty list", () => {
            expect(details([])).toStrictEqual([{ path: ["$value"], detail: "empty-font-list" }]);
        });

        it("a list with something other than a name in it", () => {
            expect(details(["Arial", 42, ""])).toStrictEqual([
                { path: ["$value", 1], detail: "not-a-font-name" },
                { path: ["$value", 2], detail: "not-a-font-name" },
            ]);
        });

        it("a curly-brace reference in place of one name, rather than reading it as a font's name", () => {
            expect(details(["{font.brand}", "serif"])).toStrictEqual([
                { path: ["$value", 0], detail: "alias-not-allowed-here" },
            ]);
        });

        it.for([42, null, true, { name: "Arial" }])("%j, which is not a name or a list", (raw) => {
            expect(details(raw)).toStrictEqual([{ path: ["$value"], detail: "wrong-shape" }]);
        });
    });
});
