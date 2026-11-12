import { describe, expect, it } from "vitest";
import { demo } from "./helpers.js";

describe("the demo the tests edit", () => {
    it("is plain DTCG: it reads with no problems, with no allowances", () => {
        expect(demo.parseOptions).toStrictEqual({
            hexStringColors: false,
            ignoreUnknownProperties: false,
        });
        expect(demo.diagnostics.map(({ kind, path }) => `${kind} ${path}`)).toStrictEqual([]);
    });

    it("keeps its type sizes bound to the sizing scale", () => {
        expect(demo.getPermutation().getToken("typography.text.base")?.original?.value).toBe(
            "{size.step.0}",
        );
        expect(demo.getPermutation().getToken("typography.text.base")?.resolved).toEqual({
            value: 1,
            unit: "rem",
        });
    });
});
