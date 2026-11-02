import { describe, expect, it } from "vitest";
import { toCSSValue } from "@sugarcube-sh/dtcg/css";
import { writtenColor } from "../../src/controllers/written-color";

describe("writtenColor", () => {
    it("rounds every number to four decimal places", () => {
        expect(
            writtenColor({
                colorSpace: "oklch",
                components: [0.97, 0.09200000000000001, 258.123456],
                alpha: 0.10200000000000001,
            }),
        ).toEqual({ colorSpace: "oklch", components: [0.97, 0.092, 258.1235], alpha: 0.102 });
    });

    it("rounds a number to the decimal it means, not its nearest binary value", () => {
        expect(
            writtenColor({ colorSpace: "oklch", components: [0.5, 0.00015, 258] }).components,
        ).toEqual([0.5, 0.0002, 258]);
    });

    it("writes a missing component as none", () => {
        expect(
            writtenColor({ colorSpace: "oklch", components: [0.5, Number.NaN, undefined] })
                .components,
        ).toEqual([0.5, "none", "none"]);
        expect(
            writtenColor({ colorSpace: "oklch", components: [0.5, 0, "none"] }).components,
        ).toEqual([0.5, 0, "none"]);
    });

    it("writes alpha and hex only when given", () => {
        expect(writtenColor({ colorSpace: "srgb", components: [1, 0, 0] })).toEqual({
            colorSpace: "srgb",
            components: [1, 0, 0],
        });
        expect(
            writtenColor({ colorSpace: "srgb", components: [1, 0, 0], alpha: 1, hex: "#ff0000" }),
        ).toEqual({ colorSpace: "srgb", components: [1, 0, 0], alpha: 1, hex: "#ff0000" });
    });

    it("keeps every digit the CSS keeps", () => {
        const written = writtenColor({
            colorSpace: "oklch",
            components: [0.97123456, 0.0123456, 258],
        });

        expect(written.components).toEqual([0.9712, 0.0123, 258]);
        expect(toCSSValue({ type: "color", resolved: { ...written, alpha: 1 } })).toBe(
            "oklch(0.9712 0.0123 258)",
        );
    });
});
