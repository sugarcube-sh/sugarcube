import type { ColorValue } from "../model.js";
import { colorDecimals, roundedTo } from "./decimals.js";
import type { ValueErrorFacts } from "./value-errors.js";

function channels(hex: string): { r: number; g: number; b: number; a: number; hex: string } {
    const full = (hex.length <= 5 ? expandedHex(hex) : hex).slice(1);
    const channel = (start: number) => Number.parseInt(full.slice(start, start + 2), 16) / 255;
    const a = full.length === 8 ? channel(6) : 1;
    return { r: channel(0), g: channel(2), b: channel(4), a, hex: `#${full.slice(0, 6)}` };
}

const READ_FROM_HEX_STRING = Symbol.for("@sugarcube-sh/dtcg/hex-string");

export function hexStringColor(hex: string): ColorValue {
    const { r, g, b, a, hex: kept } = channels(hex);
    const color: ColorValue = { colorSpace: "srgb", components: [r, g, b], alpha: a, hex: kept };
    Object.defineProperty(color, READ_FROM_HEX_STRING, { value: hex });
    return color;
}

export function getWrittenHex(color: ColorValue): string | undefined {
    const written: unknown = (color as { [READ_FROM_HEX_STRING]?: unknown })[READ_FROM_HEX_STRING];
    return typeof written === "string" ? written : undefined;
}

export function hexStringAsObject(hex: string): ValueErrorFacts["hex-string"]["asObject"] {
    const { r, g, b, a, hex: kept } = channels(hex);
    const round = (value: number) => roundedTo(value, colorDecimals);
    const withAlpha = hex.length === 5 || hex.length === 9;
    return {
        colorSpace: "srgb",
        components: [round(r), round(g), round(b)],
        ...(withAlpha && { alpha: round(a) }),
        hex: kept,
    };
}

export function expandedHex(shortHex: string): string {
    return `#${Array.from(shortHex.slice(1), (digit) => digit + digit).join("")}`;
}
