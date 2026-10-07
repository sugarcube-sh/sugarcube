import type { ColorValue } from "../index.js";
import type { ValueErrorFacts } from "./value-errors.js";

export function hexStringColor(hex: string): ColorValue {
    const digits = hex.slice(1);
    const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
    const channel = (at: number) => rounded(Number.parseInt(full.slice(at, at + 2), 16) / 255);
    return {
        colorSpace: "srgb",
        components: [channel(0), channel(2), channel(4)],
        alpha: full.length === 8 ? channel(6) : 1,
        hex: `#${full.slice(0, 6)}`,
    };
}

export function hexStringAsObject(hex: string): ValueErrorFacts["hex-string"]["asObject"] {
    const { colorSpace, components, alpha, hex: kept } = hexStringColor(hex);
    const withAlpha = hex.length === 5 || hex.length === 9;
    return { colorSpace, components, ...(withAlpha && { alpha }), hex: kept };
}

function rounded(value: number): number {
    return Math.round(value * 10_000) / 10_000;
}
