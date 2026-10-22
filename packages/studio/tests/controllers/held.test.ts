import { describe, expect, it } from "vitest";
import { heldFor, reasonsFor } from "../../src/controllers/held";

describe("heldFor", () => {
    it("gives what is held while what it is about is the same", () => {
        const about = {};

        expect(heldFor({ value: "Chroma reduced.", about }, about)).toBe("Chroma reduced.");
    });

    it("gives nothing once what it is about has changed, or with nothing held", () => {
        expect(heldFor({ value: "Chroma reduced.", about: {} }, {})).toBeUndefined();
        expect(heldFor(undefined, {})).toBeUndefined();
    });
});

describe("reasonsFor", () => {
    it("gives a refusal's reason, or each conflict's, or none for an edit made", () => {
        const conflict = {
            op: { kind: "deleteFile", file: "x.json", was: "" },
            kind: "gone",
            reason: "x.json is gone",
        } as const;

        expect(reasonsFor({ refused: { kind: "not-found", path: "x", reason: "No x." } })).toEqual([
            "No x.",
        ]);
        expect(reasonsFor({ conflicts: [conflict] })).toEqual(["x.json is gone"]);
        expect(reasonsFor(undefined)).toEqual([]);
    });
});
