import type { TokenType } from "../index.js";

/**
 * The parts of each composite type, and the type of each part, in the spec's order. For shadow
 * and gradient, these are the parts of one layer or one stop. Every part is required except a
 * shadow's `inset`, which defaults to `false`.
 *
 * @example
 * compositeParts.border // { color: "color", width: "dimension", style: "strokeStyle" }
 */
export const compositeParts = {
    border: { color: "color", width: "dimension", style: "strokeStyle" },
    transition: { duration: "duration", delay: "duration", timingFunction: "cubicBezier" },
    shadow: {
        color: "color",
        offsetX: "dimension",
        offsetY: "dimension",
        blur: "dimension",
        spread: "dimension",
        inset: "boolean",
    },
    gradient: { color: "color", position: "number" },
    typography: {
        fontFamily: "fontFamily",
        fontSize: "dimension",
        fontWeight: "fontWeight",
        letterSpacing: "dimension",
        lineHeight: "number",
    },
} as const satisfies Readonly<Record<string, Readonly<Record<string, TokenType | "boolean">>>>;
