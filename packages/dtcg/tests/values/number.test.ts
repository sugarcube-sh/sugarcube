import { describe, expect, it } from "vitest";
import { parseValue } from "../../src/values.js";

describe("parseValue, number", () => {
    it.for([0, 2.3, -1, 1e3])("reads %s", (raw) => {
        expect(parseValue("number", raw)).toStrictEqual({ ok: true, value: raw, ignored: [] });
    });

    it("reads a reference to a whole token in curly brace syntax", () => {
        expect(parseValue("number", "{line-height.large}")).toStrictEqual({
            ok: true,
            value: { syntax: "curly-brace", path: "line-height.large" },
            ignored: [],
        });
    });

    it("reads a JSON Pointer as the whole value", () => {
        expect(parseValue("number", { $ref: "#/base/blue/$value/components/0" })).toStrictEqual({
            ok: true,
            value: { syntax: "json-pointer", pointer: "#/base/blue/$value/components/0" },
            ignored: [],
        });
    });

    it.for(["2.3", "50%", null, true, [1], { value: 1 }])(
        "refuses %j, which is not a JSON number",
        (raw) => {
            const result = parseValue("number", raw, { jsonPath: ["$value"] });
            expect(
                result.ok
                    ? []
                    : result.errors.map(({ jsonPath, detail }) => ({ jsonPath, detail })),
            ).toStrictEqual([
                {
                    jsonPath: ["$value"],
                    detail: { type: "number", reason: "not-a-number", value: raw },
                },
            ]);
        },
    );
});
