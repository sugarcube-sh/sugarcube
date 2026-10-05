import { describe, expect, it } from "vitest";
import { parseNumber } from "../../src/values.js";

describe("parseNumber", () => {
    it.for([0, 2.3, -1, 1e3])("reads %s", (raw) => {
        expect(parseNumber(raw, [])).toStrictEqual({ ok: true, value: raw, ignored: [] });
    });

    it("reads a reference to a whole token as an alias", () => {
        expect(parseNumber("{line-height.large}", [])).toStrictEqual({
            ok: true,
            value: { alias: "line-height.large" },
            ignored: [],
        });
    });

    it("reads a JSON Pointer as the whole value", () => {
        expect(parseNumber({ $ref: "#/base/blue/$value/components/0" }, [])).toStrictEqual({
            ok: true,
            value: { pointer: "#/base/blue/$value/components/0" },
            ignored: [],
        });
    });

    it.for(["2.3", "50%", null, true, [1], { value: 1 }])(
        "refuses %j, which is not a JSON number",
        (raw) => {
            const result = parseNumber(raw, ["$value"]);
            expect(
                result.ok ? [] : result.errors.map(({ path, detail }) => ({ path, detail })),
            ).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "number", reason: "not-a-number", value: raw },
                },
            ]);
        },
    );
});
