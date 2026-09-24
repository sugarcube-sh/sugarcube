import { convertColorToString } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import {
    type ColorShape,
    pickerSpaceFor,
    readColorShape,
    readLiteralColor,
    sameColorValue,
    writeColor,
} from "../src/tokens/color-shape";

const OKLCH = {
    colorSpace: "oklch",
    components: [0.624, 0.181, 258],
    hex: "#4d7bd9",
} as const;

function shapeOf(value: unknown): ColorShape {
    const shape = readColorShape(value);
    if (!shape) throw new Error(`no shape for ${JSON.stringify(value)}`);
    return shape;
}

describe("readColorShape", () => {
    it("offers no shape for a space the picker cannot write back", () => {
        expect(readColorShape("oklab(0.7 0.1 -0.1)")).toBeUndefined();
        expect(readColorShape("lab(50% 40 59.5)")).toBeUndefined();
        expect(readColorShape("hwb(194 0% 0%)")).toBeUndefined();
        expect(readLiteralColor("lch(52% 58 235)")).toBeUndefined();
    });

    it("reads a DTCG object, its space, and whether it carries a hex", () => {
        expect(readColorShape(OKLCH)).toEqual({
            kind: "object",
            space: "oklch",
            hex: true,
            alpha: false,
        });
    });

    it("reads a hex string, remembering alpha and case", () => {
        expect(readColorShape("#fcfcfc")).toEqual({
            kind: "hex",
            hasAlpha: false,
            uppercase: false,
        });
        expect(readColorShape("#FAF9F5")).toEqual({
            kind: "hex",
            hasAlpha: false,
            uppercase: true,
        });
        expect(readColorShape("#1c1c1a26")).toEqual({
            kind: "hex",
            hasAlpha: true,
            uppercase: false,
        });
    });

    it("is not a literal colour when it is a reference", () => {
        expect(readColorShape("{color.brand.500}")).toBeUndefined();
    });

    it("is not a literal colour when it is nonsense", () => {
        expect(readColorShape("not a colour")).toBeUndefined();
        expect(readColorShape(42)).toBeUndefined();
    });
});

describe("pickerSpaceFor", () => {
    it("pins the picker to the token's own space", () => {
        expect(pickerSpaceFor(shapeOf(OKLCH))).toBe("oklch");
        expect(pickerSpaceFor(shapeOf("#fcfcfc"))).toBe("hex");
        expect(
            pickerSpaceFor(shapeOf({ colorSpace: "display-p3", components: [0.3, 0.7, 0.95] })),
        ).toBe("display-p3");
    });
});

describe("readLiteralColor", () => {
    it("opens the picker on the colour the build emits", () => {
        expect(readLiteralColor(OKLCH)).toEqual({
            css: "oklch(0.624 0.181 258)",
            space: "oklch",
            shape: shapeOf(OKLCH),
        });
    });

    it("passes a hex through untouched", () => {
        expect(readLiteralColor("#fcfcfc")?.css).toBe("#fcfcfc");
    });
});

describe("writeColor keeps the authored shape", () => {
    it("writes an oklch object back as an oklch object", () => {
        const next = writeColor(shapeOf(OKLCH), "oklch(0.55 0.2 145)");

        expect(next).toEqual({
            colorSpace: "oklch",
            components: [0.55, 0.2, 145],
            hex: expect.any(String),
        });
    });

    it("does not turn an oklch token into a hex when a hex is picked", () => {
        const next = writeColor(shapeOf(OKLCH), "#4d7bd9");

        expect(next).toMatchObject({ colorSpace: "oklch" });
        expect(typeof next).toBe("object");
    });

    it("writes a hex token back as a hex", () => {
        expect(writeColor(shapeOf("#fcfcfc"), "oklch(0.55 0.2 145)")).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("keeps the case the author used", () => {
        expect(writeColor(shapeOf("#FAF9F5"), "#aabbcc")).toBe("#AABBCC");
        expect(writeColor(shapeOf("#faf9f5"), "#AABBCC")).toBe("#aabbcc");
    });

    it("keeps alpha on a hex that had it", () => {
        expect(writeColor(shapeOf("#1c1c1a26"), "#334455")).toMatch(/^#[0-9a-f]{8}$/);
    });

    it("adds alpha to a hex that did not have it, when the colour has some", () => {
        expect(writeColor(shapeOf("#fcfcfc"), "rgb(0 0 0 / 0.5)")).toMatch(/^#[0-9a-f]{8}$/);
    });

    it("refuses a string that is not a colour, so the token is left alone", () => {
        expect(writeColor(shapeOf(OKLCH), "nonsense")).toBeUndefined();
    });
});

describe("writeColor uses DTCG's units, not culori's", () => {
    it("writes hsl saturation and lightness as 0-100", () => {
        const shape = shapeOf({ colorSpace: "hsl", components: [240, 80, 60] });
        const next = writeColor(shape, "hsl(120 50% 25%)");

        expect(next).toEqual({ colorSpace: "hsl", components: [120, 50, 25] });
    });

    it("writes srgb and display-p3 components as 0-1", () => {
        const srgb = writeColor(
            shapeOf({ colorSpace: "srgb", components: [0, 0, 0] }),
            "rgb(255 0 0)",
        );
        expect(srgb).toEqual({ colorSpace: "srgb", components: [1, 0, 0] });

        const p3 = writeColor(
            shapeOf({ colorSpace: "display-p3", components: [0, 0, 0] }),
            "color(display-p3 0.3 0.7 0.95)",
        );
        expect(p3).toEqual({ colorSpace: "display-p3", components: [0.3, 0.7, 0.95] });
    });

    it("keeps hue inside [0, 360), which core's validator requires", () => {
        const shape = shapeOf(OKLCH);

        const wrapped = writeColor(shape, "oklch(0.55 0.2 360)") as { components: number[] };
        expect(wrapped.components[2]).toBe(0);

        const negative = writeColor(shape, "oklch(0.55 0.2 -30)") as { components: number[] };
        expect(negative.components[2]).toBe(330);
    });

    it("produces a value core can render", () => {
        const next = writeColor(shapeOf(OKLCH), "oklch(0.55 0.2 145)");
        const rendered = convertColorToString(next as never);

        expect(rendered.success).toBe(true);
    });
});

describe("the hex fallback", () => {
    it("regenerates it, so the polyfill fallback is not left on the old colour", () => {
        const next = writeColor(shapeOf(OKLCH), "oklch(0.55 0.2 145)") as { hex: string };

        expect(next.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(next.hex).not.toBe(OKLCH.hex);
    });

    it("gamut maps rather than clipping, so a wide colour still gets a usable hex", () => {
        const next = writeColor(shapeOf(OKLCH), "oklch(0.7 0.4 145)") as { hex: string };

        expect(next.hex).toBe("#00c300");
        expect(next.hex).not.toBe("#00d200");
    });

    it("does not add one to a token that never had one", () => {
        const shape = shapeOf({ colorSpace: "oklch", components: [0.624, 0.181, 258] });
        const next = writeColor(shape, "oklch(0.55 0.2 145)");

        expect(next).not.toHaveProperty("hex");
    });
});

describe("sameColorValue", () => {
    it("spots a no-op edit, so the picker cannot invent a pending change", () => {
        expect(sameColorValue(OKLCH, { ...OKLCH })).toBe(true);
        expect(sameColorValue("#fcfcfc", "#fcfcfc")).toBe(true);
    });

    it("spots a real one", () => {
        expect(sameColorValue(OKLCH, { ...OKLCH, components: [0.5, 0.181, 258] })).toBe(false);
        expect(sameColorValue("#fcfcfc", "#fcfcfd")).toBe(false);
        expect(sameColorValue(OKLCH, { ...OKLCH, hex: "#000000" })).toBe(false);
    });
});
