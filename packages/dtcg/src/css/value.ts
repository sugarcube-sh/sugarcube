import type {
    ColorComponent,
    ColorValue,
    GradientStopPart,
    Part,
    PartBase,
    Reference,
    ShadowLayerPart,
    Token,
    TypographyPart,
} from "../model.js";
import { colorDecimals, roundedTo } from "../values/decimals.js";
import { getWrittenHex } from "../values/hex-color.js";

/** A typography value written as CSS, one value for each CSS property. */
export interface TypographyCSS {
    readonly "font-family": string;
    readonly "font-size": string;
    readonly "font-weight": string;
    readonly "letter-spacing": string;
    readonly "line-height": string;
}

/**
 * What to write for a reference.
 *
 * Either a custom property's name, or your own CSS.
 */
export type Replacement = { customProperty: string } | { css: string };

/** How {@link toCSSValue} writes a value. */
export interface CSSValueOptions {
    /**
     * Writes a reference your own way, such as with `var()`.
     *
     * Without it, or when it returns `undefined`, the value the reference resolves to is written.
     *
     * @param ref - The reference, such as a token's `getReferenceAt()`.
     * @param cssProperty - For a typography reference, the CSS property being written, such as
     * `"font-size"`.
     *
     * @example
     * // Write each reference to a whole token as var()
     * replaceReference: (ref, cssProperty) =>
     *     ref.pointsToWholeToken && {
     *         customProperty: toCustomPropertyName(ref.pointsToWholeToken.path, { cssProperty }),
     *     }
     */
    replaceReference?: (
        ref: Reference,
        cssProperty?: keyof TypographyCSS,
    ) => Replacement | undefined;
    /**
     * How colors are written.
     *
     * `"components"` writes each color in its own color space.
     * `"hex"` writes a color's `hex` fallback, if it has one, with alpha digits if it isn't opaque.
     *
     * @default "components"
     */
    colors?: "components" | "hex";
}

/**
 * Writes a token's value, or part of one, as CSS.
 *
 * For typography, it returns an object, with one value for each CSS property. For a gradient, it
 * returns only the stops, for inside `linear-gradient()`.
 *
 * @param of - A token, such as `permutation.getToken("color.primary")`, or part of one, such as a
 * border's `color`.
 * @param options - How to write references and colors.
 *
 * @example
 * // color.primary in mode: dark
 * toCSSValue(dark.getToken("color.primary"))
 * // => "rgb(102 153 255)"
 */
export function toCSSValue(
    of: Extract<Token, { type: "typography" }> | TypographyPart | undefined,
    options?: CSSValueOptions,
): TypographyCSS | undefined;
export function toCSSValue(
    of: Exclude<Token, { type: "typography" }> | Exclude<Part, TypographyPart> | undefined,
    options?: CSSValueOptions,
): string | undefined;
export function toCSSValue(
    of: Token | Part | undefined,
    options?: CSSValueOptions,
): string | TypographyCSS | undefined;
export function toCSSValue(
    of: Token | Part | undefined,
    options: CSSValueOptions = {},
): string | TypographyCSS | undefined {
    if (of === undefined) return undefined;
    const whole = "path" in of ? of.parts : of;
    if (!whole) return undefined;
    return whole.type === "typography" ? typography(whole, options) : write(whole, options);
}

function replaced({ ref }: PartBase<unknown>, { replaceReference }: CSSValueOptions) {
    return ref ? replaceReference?.(ref) : undefined;
}

function customProperty(part: PartBase<unknown>, options: CSSValueOptions): string | undefined {
    const answer = replaced(part, options);
    return answer && "customProperty" in answer ? answer.customProperty : undefined;
}

function replacedCSS(part: PartBase<unknown>, options: CSSValueOptions): string | undefined {
    const answer = replaced(part, options);
    return answer && ("customProperty" in answer ? `var(${answer.customProperty})` : answer.css);
}

function write(part: Exclude<Part, TypographyPart>, options: CSSValueOptions): string {
    const css = replacedCSS(part, options);
    if (css !== undefined) return css;
    const each = (inner: Exclude<Part, TypographyPart>) => write(inner, options);
    switch (part.type) {
        case "color":
            return writeColor(part.resolved, options.colors ?? "components");
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
            return typeof part.resolved === "string" ? part.resolved : "dashed";
        case "border":
            return [part.width, part.style, part.color].map(each).join(" ");
        case "transition":
            return [part.duration, part.timingFunction, part.delay].map(each).join(" ");
        case "shadow":
            return part.layers.map((one) => layer(one, options)).join(", ");
        case "gradient":
            return part.stops.map((one) => stop(one, options)).join(", ");
    }
}

function layer(part: ShadowLayerPart, options: CSSValueOptions): string {
    const css = replacedCSS(part, options);
    if (css !== undefined) return css;
    const lengths = [part.offsetX, part.offsetY, part.blur, part.spread, part.color];
    const written = lengths.map((one) => write(one, options));
    return `${part.resolved.inset ? "inset " : ""}${written.join(" ")}`;
}

function stop({ color, position }: GradientStopPart, options: CSSValueOptions): string {
    const named = customProperty(position, options);
    const where = named
        ? `clamp(0%, var(${named}) * 100%, 100%)`
        : `${roundedTo(position.resolved * 100, 4)}%`;
    return `${write(color, options)} ${where}`;
}

function typography(part: TypographyPart, options: CSSValueOptions): TypographyCSS {
    const each = (cssProperty: keyof TypographyCSS, value: Exclude<Part, TypographyPart>) => {
        const answer = part.ref ? options.replaceReference?.(part.ref, cssProperty) : undefined;
        return answer && "customProperty" in answer
            ? `var(${answer.customProperty})`
            : write(value, options);
    };
    return {
        "font-family": each("font-family", part.fontFamily),
        "font-size": each("font-size", part.fontSize),
        "font-weight": each("font-weight", part.fontWeight),
        "letter-spacing": each("letter-spacing", part.letterSpacing),
        "line-height": each("line-height", part.lineHeight),
    };
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

function writeColor(color: ColorValue, colors: "components" | "hex"): string {
    const { colorSpace, components, alpha, hex } = color;
    const asRead = getWrittenHex(color);
    if (asRead !== undefined) return asRead;
    if (hex !== undefined && colors === "hex") return addAlpha(hex, alpha);
    const [a, b, c] = components;
    const numbers = [a, b, c].map((each) => fixed(each)).join(" ");
    switch (colorSpace) {
        case "srgb":
            return withAlpha(`rgb(${[a, b, c].map(channel).join(" ")}`, alpha);
        case "hsl":
            return withAlpha(`hsl(${fixed(a)} ${percent(b)} ${percent(c)}`, alpha);
        case "hwb":
            return withAlpha(`hwb(${fixed(a)} ${percent(b)} ${percent(c)}`, alpha);
        case "lab":
        case "lch":
        case "oklab":
        case "oklch":
            return withAlpha(`${colorSpace}(${numbers}`, alpha);
        case "srgb-linear":
        case "display-p3":
        case "a98-rgb":
        case "prophoto-rgb":
        case "rec2020":
        case "xyz-d65":
        case "xyz-d50":
            return withAlpha(`color(${colorSpace} ${numbers}`, alpha);
    }
}

function withAlpha(opened: string, alpha: number): string {
    return alpha === 1 ? `${opened})` : `${opened} / ${fixed(alpha)})`;
}

function channel(component: ColorComponent): string {
    return component === "none" ? "none" : String(roundedTo(component * 255, 2));
}

function percent(component: ColorComponent): string {
    return component === "none" ? "none" : `${fixed(component)}%`;
}

function fixed(component: ColorComponent): string {
    return component === "none" ? "none" : String(roundedTo(component, colorDecimals));
}

function addAlpha(hex: string, alpha: number): string {
    if (alpha === 1) return hex;
    const pair = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hex}${/[A-F]/.test(hex) && !/[a-f]/.test(hex) ? pair.toUpperCase() : pair}`;
}
