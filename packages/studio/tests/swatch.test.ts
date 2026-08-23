import { describe, expect, it } from "vitest";
import { sampleShades } from "../src/components/controls/Swatch";

const ids = (length: number) => Array.from({ length }, (_, i) => String(i + 1));

describe("sampleShades", () => {
    it("samples from the middle band of a long ramp, not the extremes", () => {
        expect(sampleShades(ids(12), 3)).toEqual(["4", "7", "9"]);
    });

    it("samples the interior of a medium ramp", () => {
        expect(sampleShades(ids(5), 3)).toEqual(["2", "3", "4"]);
    });

    it("clusters around the centre when the ramp is too short for a margin band", () => {
        expect(sampleShades(ids(4), 3)).toEqual(["1", "2", "3"]);
    });

    it("returns the whole ramp when it fits in the preview count", () => {
        expect(sampleShades(ids(3), 3)).toEqual(["1", "2", "3"]);
    });
});
