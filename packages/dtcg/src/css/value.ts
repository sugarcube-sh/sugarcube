import type {
    Alias,
    ColorComponent,
    ColorValue,
    GradientStopPart,
    Part,
    PartBase,
    Pointer,
    ShadowLayerPart,
    Token,
    TypographyPart,
} from "../index.js";
import { parts } from "../lookup/parts.js";

/** A typography value written as CSS: one value for each CSS property it sets, in this order. */
export interface TypographyCSS {
    "font-family": string;
    "font-size": string;
    "font-weight": string;
    "letter-spacing": string;
    "line-height": string;
}

/** What to write in place of a reference: a CSS variable, given by its name, or CSS of your own. */
export type Replacement = { variable: string } | { css: string };

export interface CSSValueOptions {
    /**
     * What to write for a reference, such as a variable for the token it refers to. Without an
     * answer, the part is written from the value the reference resolved to. A gradient stop's
     * position takes a variable only, as `clamp(0%, var(…) * 100%, 100%)`; a typography value
     * that is itself a reference takes a variable only, writing `var(--name-font-size)` and so on.
     *
     * @example
     * { replacement: (ref) => (isAlias(ref) ? { variable: cssVariable(ref.alias) } : undefined) }
     */
    replacement?: (ref: Alias | Pointer) => Replacement | undefined;
    /**
     * `"hex"` writes every color that has a `hex` as that hex, with two more digits when it is
     * not opaque, for a browser that cannot show its color space. A color without a `hex` is
     * written as usual.
     * @default "native"
     */
    colors?: "native" | "hex";
}

type TypographyToken = Extract<Token, { type: "typography" }>;

/**
 * A token's value, or a part of one, written as CSS: a string for every type but typography,
 * which sets five CSS properties and so gives an object with a value for each. Code holding a
 * token of any type checks its `type` first, as it would to show typography differently anyway.
 * A color is written in its own color space, and an sRGB color with a `hex` as that hex. A
 * gradient is written as its stops, for any gradient function: `linear-gradient(${css})`.
 * `undefined` for a token with no resolved value.
 *
 * @example
 * cssValue(brand)                  // "#e11d48"
 * cssValue(card)                   // "0px 2px 4px 0px #00000033"
 * if (token.type === "typography") cssValue(token)?.["font-size"]   // "1rem"
 *
 * @example
 * // a border part, for a swatch of its color
 * const border = parts(token);
 * if (border?.type === "border") swatch(cssValue(border.color));
 */
export function cssValue(
    of: TypographyToken | TypographyPart,
    options?: CSSValueOptions,
): TypographyCSS | undefined;
export function cssValue(
    of: Exclude<Token, TypographyToken> | Exclude<Part, TypographyPart>,
    options?: CSSValueOptions,
): string | undefined;
export function cssValue(
    of: Token | Part,
    options?: CSSValueOptions,
): string | TypographyCSS | undefined;
export function cssValue(
    of: Token | Part,
    { replacement, colors = "native" }: CSSValueOptions = {},
): string | TypographyCSS | undefined {
    const whole = "path" in of ? parts(of) : of;
    if (!whole) return undefined;

    const replaced = ({ ref }: PartBase<unknown>) => (ref ? replacement?.(ref) : undefined);
    const variable = (part: PartBase<unknown>) => {
        const answer = replaced(part);
        return answer && "variable" in answer ? answer.variable : undefined;
    };

    const write = (part: Exclude<Part, TypographyPart>): string => {
        const answer = replaced(part);
        if (answer) return "variable" in answer ? `var(${answer.variable})` : answer.css;
        switch (part.type) {
            case "color":
                return writeColor(part.resolved, colors);
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
                return part.stops.map(stop).join(", ");
        }
    };

    const layer = (part: ShadowLayerPart): string => {
        const answer = replaced(part);
        if (answer) return "variable" in answer ? `var(${answer.variable})` : answer.css;
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

    const typography = (part: TypographyPart): TypographyCSS => {
        const named = variable(part);
        const each = (property: keyof TypographyCSS, value: Exclude<Part, TypographyPart>) =>
            named ? `var(${named}-${property})` : write(value);
        return {
            "font-family": each("font-family", part.fontFamily),
            "font-size": each("font-size", part.fontSize),
            "font-weight": each("font-weight", part.fontWeight),
            "letter-spacing": each("letter-spacing", part.letterSpacing),
            "line-height": each("line-height", part.lineHeight),
        };
    };

    return whole.type === "typography" ? typography(whole) : write(whole);
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

function writeColor(
    { colorSpace, components, alpha, hex }: ColorValue,
    colors: "native" | "hex",
): string {
    if (hex !== undefined && (colors === "hex" || colorSpace === "srgb")) return hexOf(hex, alpha);
    const [a, b, c] = components;
    const four = [a, b, c].map((each) => fixed(each, 4)).join(" ");
    switch (colorSpace) {
        case "srgb":
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
