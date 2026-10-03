import {
    type Alias,
    type ColorComponent,
    type ColorValue,
    type GradientStopPart,
    type Part,
    type PartBase,
    type Pointer,
    type ShadowLayerPart,
    type Token,
    type TypographyPart,
    parts,
} from "@sugarcube-sh/dtcg";
import type { FluidConfig } from "../../types/config.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { type FluidRange, readFluid } from "../fluid.js";
import { calculateClamp } from "./clamp.js";

export interface Written {
    suffix: string;
    value: string;
}

export type VariableFor = (ref: Alias | Pointer) => string | undefined;

export function renderToken(
    token: Token,
    variableFor: VariableFor,
    options: { fluid: FluidConfig },
): Written[] | undefined {
    const whole = parts(token);
    const fluid =
        token.type === "dimension" ? readFluid(token.extensions?.[SUGARCUBE_NAMESPACE]) : undefined;
    if (!whole || fluid?.ok === false) return undefined;
    const range = fluid?.ok ? fluid.value : undefined;

    const variable = ({ ref }: PartBase<unknown>) => ref && variableFor(ref);

    const write = (part: Exclude<Part, TypographyPart>): string => {
        const named = variable(part);
        if (named) return `var(${named})`;
        switch (part.type) {
            case "color":
                return renderColor(part.resolved);
            case "dimension":
            case "duration":
                return `${part.resolved.value}${part.resolved.unit}`;
            case "cubicBezier":
                return `cubic-bezier(${part.resolved.join(", ")})`;
            case "number":
            case "fontWeight":
                return String(part.resolved);
            case "fontFamily":
                return part.resolved.map(quoteFont).join(", ");
            case "strokeStyle":
                return part.resolved.kind === "dash" ? "dashed" : part.resolved.keyword;
            case "border":
                return [part.width, part.style, part.color].map(write).join(" ");
            case "transition":
                return [part.duration, part.timingFunction, part.delay].map(write).join(" ");
            case "shadow":
                return part.layers.map(layer).join(", ");
            case "gradient":
                return `linear-gradient(${part.stops.map(stop).join(", ")})`;
        }
    };

    const layer = (part: ShadowLayerPart): string => {
        const named = variable(part);
        if (named) return `var(${named})`;
        const lengths = [part.offsetX, part.offsetY, part.blur, part.spread, part.color];
        return `${part.resolved.inset ? "inset " : ""}${lengths.map(write).join(" ")}`;
    };

    const stop = ({ color, position }: GradientStopPart): string => {
        const named = variable(position);
        const where = named
            ? `clamp(0%, var(${named}) * 100%, 100%)`
            : `${round(position.resolved * 100, 4)}%`;
        return `${write(color)} ${where}`;
    };

    const typography = (part: TypographyPart): Written[] => {
        const named = variable(part);
        const each = [
            ["-font-family", part.fontFamily],
            ["-font-size", part.fontSize],
            ["-font-weight", part.fontWeight],
            ["-letter-spacing", part.letterSpacing],
            ["-line-height", part.lineHeight],
        ] as const;
        return each.map(([suffix, of]) => ({
            suffix,
            value: named ? `var(${named}${suffix})` : write(of),
        }));
    };

    if (whole.type === "typography") return typography(whole);
    const value = range && !variable(whole) ? clamp(range, options.fluid) : write(whole);
    return [{ suffix: "", value }];
}

function clamp({ min, max }: FluidRange, viewport: FluidConfig): string {
    const pixels = ({ value, unit }: FluidRange["min"]) => (unit === "px" ? value : value * 16);
    const [minSize, maxSize] = [pixels(min), pixels(max)];
    if (minSize === maxSize) return `${round(minSize / 16, 4)}rem`;
    return calculateClamp({ minSize, maxSize, minWidth: viewport.min, maxWidth: viewport.max });
}

const GENERIC_FAMILIES = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
]);

const CSS_WIDE_KEYWORDS = new Set([
    "inherit",
    "initial",
    "unset",
    "revert",
    "revert-layer",
    "default",
]);

function quoteFont(name: string): string {
    const lower = name.toLowerCase();
    if (GENERIC_FAMILIES.has(lower)) return name;
    const bare =
        !/[\s'"!@#$%^&*()=+[\]{};:|\\/,.<>?~]/.test(name) &&
        !/^(-?\d|--)/.test(name) &&
        !CSS_WIDE_KEYWORDS.has(lower);
    return bare ? name : `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function renderColor({ colorSpace, components, alpha, hex }: ColorValue): string {
    const [a, b, c] = components;
    const four = [a, b, c].map((each) => fixed(each, 4)).join(" ");
    switch (colorSpace) {
        case "srgb":
            if (hex !== undefined) return hexOf(hex, alpha);
            return withAlpha(`rgb(${[a, b, c].map(channel).join(" ")}`, alpha);
        case "hsl":
            return withAlpha(`hsl(${fixed(a, 1)} ${percent(b, 0)} ${percent(c, 0)}`, alpha);
        case "hwb":
            return withAlpha(`hwb(${fixed(a, 4)} ${percent(b, 4)} ${percent(c, 4)}`, alpha);
        case "lab":
        case "lch":
        case "oklab":
        case "oklch":
            return withAlpha(`${colorSpace}(${four}`, alpha);
        case "srgb-linear":
        case "display-p3":
        case "a98-rgb":
        case "prophoto-rgb":
        case "rec2020":
        case "xyz-d65":
        case "xyz-d50":
            return withAlpha(`color(${colorSpace} ${four}`, alpha);
    }
}

function withAlpha(opened: string, alpha: number): string {
    return alpha === 1 ? `${opened})` : `${opened} / ${fixed(alpha, 4)})`;
}

function channel(component: ColorComponent): string {
    return component === "none" ? "none" : String(Math.round(component * 255));
}

function percent(component: ColorComponent, digits: number): string {
    return component === "none" ? "none" : `${fixed(component, digits)}%`;
}

function fixed(component: ColorComponent, digits: number): string {
    return component === "none" ? "none" : String(round(component, digits));
}

function round(value: number, digits: number): number {
    const scaled = Number((Math.abs(value) * 10 ** digits).toPrecision(15));
    return (Math.sign(value) * Math.round(scaled)) / 10 ** digits;
}

function hexOf(hex: string, alpha: number): string {
    if (alpha === 1) return hex;
    const pair = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hex}${/[A-F]/.test(hex) && !/[a-f]/.test(hex) ? pair.toUpperCase() : pair}`;
}
