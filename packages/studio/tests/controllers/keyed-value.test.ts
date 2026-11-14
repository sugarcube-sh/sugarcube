import { describe, expect, it } from "vitest";
import { getValueForKey, getReasons } from "../../src/controllers/keyed-value";

describe("getValueForKey", () => {
    it("gives what is held while what it is about is the same", () => {
        const about = {};

        expect(getValueForKey({ value: "Chroma reduced.", key: about }, about)).toBe(
            "Chroma reduced.",
        );
    });

    it("gives nothing once what it is about has changed, or with nothing held", () => {
        expect(getValueForKey({ value: "Chroma reduced.", key: {} }, {})).toBeUndefined();
        expect(getValueForKey(undefined, {})).toBeUndefined();
    });
});

describe("getReasons", () => {
    it("gives a refusal's reason, or each conflict's, or none for an edit made", () => {
        const conflict = {
            op: { kind: "delete-file", file: "x.json", was: "" },
            kind: "gone",
            reason: "x.json is gone",
        } as const;

        expect(getReasons({ refusal: { kind: "not-found", path: "x", reason: "No x." } })).toEqual([
            "No x.",
        ]);
        expect(getReasons({ conflicts: [conflict] })).toEqual(["x.json is gone"]);
        expect(getReasons(undefined)).toEqual([]);
    });
});
