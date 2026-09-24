import {
    type DTCGColorSpace,
    type DTCGColorValue,
    convertColorToString,
    isDTCGColorValue,
    roundTo,
} from "@sugarcube-sh/core/client";
import {
    type Color,
    formatCss,
    formatHex,
    formatHex8,
    modeHsl,
    modeOklch,
    modeP3,
    modeRgb,
    parse,
    toGamut,
    useMode,
} from "culori/fn";

const toRgb = useMode(modeRgb);
const toHsl = useMode(modeHsl);
const toP3 = useMode(modeP3);
const toOklch = useMode(modeOklch);

const mapToSRGB = toGamut("rgb", "oklch");

export type ColorShape =
    | { kind: "hex"; hasAlpha: boolean; uppercase: boolean }
    | { kind: "string"; space: DTCGColorSpace }
    | { kind: "object"; space: DTCGColorSpace; hex: boolean; alpha: boolean };

export type PickerSpace = "hex" | DTCGColorSpace;

export type LiteralColor = {
    css: string;
    space: PickerSpace;
    shape: ColorShape;
};

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const SPACE_BY_MODE: Record<string, DTCGColorSpace> = {
    rgb: "srgb",
    hsl: "hsl",
    p3: "display-p3",
    oklch: "oklch",
};

export function readColorShape(value: unknown): ColorShape | undefined {
    if (isDTCGColorValue(value)) {
        return {
            kind: "object",
            space: value.colorSpace,
            hex: value.hex !== undefined,
            alpha: value.alpha !== undefined,
        };
    }

    if (typeof value !== "string" || value.startsWith("{")) return undefined;

    const hex = HEX.exec(value);
    if (hex) {
        const body = hex[1] as string;
        return {
            kind: "hex",
            hasAlpha: body.length === 4 || body.length === 8,
            uppercase: /[A-F]/.test(body) && !/[a-f]/.test(body),
        };
    }

    const space = SPACE_BY_MODE[parse(value)?.mode ?? ""];
    return space === undefined ? undefined : { kind: "string", space };
}

export function pickerSpaceFor(shape: ColorShape): PickerSpace {
    return shape.kind === "hex" ? "hex" : shape.space;
}

export function readLiteralColor(value: unknown): LiteralColor | undefined {
    const shape = readColorShape(value);
    if (!shape) return undefined;

    const css = convertColorToString(value as string | DTCGColorValue);
    if (!css.success) return undefined;

    return { css: css.value, space: pickerSpaceFor(shape), shape };
}

export function writeColor(shape: ColorShape, css: string): string | DTCGColorValue | undefined {
    const color = parse(css);
    if (!color) return undefined;

    if (shape.kind === "hex") {
        const alpha = color.alpha ?? 1;
        const hex = shape.hasAlpha || alpha < 1 ? formatHex8(color) : formatHex(color);
        if (!hex) return undefined;
        return shape.uppercase ? hex.toUpperCase() : hex;
    }

    if (shape.kind === "string") {
        return formatCss(inSpace(shape.space, color));
    }

    const alpha = color.alpha ?? 1;
    const next: DTCGColorValue = {
        colorSpace: shape.space,
        components: componentsIn(shape.space, color),
    };

    if (alpha !== 1 || shape.alpha) next.alpha = roundTo(alpha);

    // The polyfill fallback the CSS renderer emits for oklch and display-p3.
    // Regenerated rather than dropped: `renderColor` throws without it, so
    // dropping the field turns a colour edit into a build failure. Only ever
    // regenerated, never added — a token that had no hex still has none.
    if (shape.hex) next.hex = fallbackHex(color, alpha);

    return next;
}

function fallbackHex(color: Color, alpha: number): string {
    const mapped = mapToSRGB(color);
    return alpha < 1 ? formatHex8({ ...mapped, alpha }) : formatHex(mapped);
}

function inSpace(space: DTCGColorSpace, color: Color): Color {
    switch (space) {
        case "oklch":
            return toOklch(color);
        case "display-p3":
            return toP3(color);
        case "hsl":
            return toHsl(color);
        case "srgb":
            return toRgb(color);
    }
}

function componentsIn(space: DTCGColorSpace, color: Color): [number, number, number] {
    switch (space) {
        case "oklch": {
            const c = toOklch(color);
            return [clamp(c.l, 0, 1), Math.max(0, roundTo(c.c)), hue(c.h)];
        }
        case "display-p3": {
            const c = toP3(color);
            return [clamp(c.r, 0, 1), clamp(c.g, 0, 1), clamp(c.b, 0, 1)];
        }
        case "hsl": {
            const c = toHsl(color);
            return [hue(c.h), percent(c.s), percent(c.l)];
        }
        case "srgb": {
            const c = toRgb(color);
            return [clamp(c.r, 0, 1), clamp(c.g, 0, 1), clamp(c.b, 0, 1)];
        }
    }
}

function clamp(value: number, min: number, max: number): number {
    return roundTo(Math.min(max, Math.max(min, value)));
}

function percent(value: number | undefined): number {
    return clamp((value ?? 0) * 100, 0, 100);
}

function hue(value: number | undefined): number {
    const wrapped = roundTo((((value ?? 0) % 360) + 360) % 360, 2);
    return wrapped >= 360 ? 0 : wrapped;
}

export function sameColorValue(a: unknown, b: unknown): boolean {
    if (typeof a === "string" || typeof b === "string") return a === b;
    if (!isDTCGColorValue(a) || !isDTCGColorValue(b)) return false;

    return (
        a.colorSpace === b.colorSpace &&
        a.alpha === b.alpha &&
        a.hex === b.hex &&
        a.components.every((component, index) => component === b.components[index])
    );
}
