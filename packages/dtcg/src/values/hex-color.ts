import type { ColorValue } from "../model/index.js";
import { colorDecimals, roundToDigits } from "./decimals.js";
import type { ValueErrorDetailByCode } from "./value-errors.js";

function parseHexChannels(hex: string): {
    r: number;
    g: number;
    b: number;
    a: number;
    hex: string;
} {
    const full = (hex.length <= 5 ? expandHex(hex) : hex).slice(1);
    const channel = (start: number) => Number.parseInt(full.slice(start, start + 2), 16) / 255;
    const a = full.length === 8 ? channel(6) : 1;
    return { r: channel(0), g: channel(2), b: channel(4), a, hex: `#${full.slice(0, 6)}` };
}

const READ_FROM_HEX_STRING = Symbol.for("@sugarcube-sh/dtcg/hex-string");

export function parseHexColor(hex: string): ColorValue {
    const { r, g, b, a, hex: parsedHex } = parseHexChannels(hex);
    const color: ColorValue = {
        colorSpace: "srgb",
        components: [r, g, b],
        alpha: a,
        hex: parsedHex,
    };
    Object.defineProperty(color, READ_FROM_HEX_STRING, { value: hex });
    return color;
}

export function getOriginalHex(color: ColorValue): string | undefined {
    const original: unknown = (color as { [READ_FROM_HEX_STRING]?: unknown })[READ_FROM_HEX_STRING];
    return typeof original === "string" ? original : undefined;
}

export function hexToColorObject(hex: string): ValueErrorDetailByCode["hex-string"]["asObject"] {
    const { r, g, b, a, hex: parsedHex } = parseHexChannels(hex);
    const round = (value: number) => roundToDigits(value, colorDecimals);
    const withAlpha = hex.length === 5 || hex.length === 9;
    return {
        colorSpace: "srgb",
        components: [round(r), round(g), round(b)],
        ...(withAlpha && { alpha: round(a) }),
        hex: parsedHex,
    };
}

export function expandHex(shortHex: string): string {
    return `#${Array.from(shortHex.slice(1), (digit) => digit + digit).join("")}`;
}
