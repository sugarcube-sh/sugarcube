import type { StrokeStyleValue } from "../index.js";

/** The spec's font weight keywords and the numbers they stand for, such as `bold: 700`. */
export const fontWeightKeywords: Readonly<Record<string, number>> = {
    "thin": 100,
    "hairline": 100,
    "extra-light": 200,
    "ultra-light": 200,
    "light": 300,
    "normal": 400,
    "regular": 400,
    "book": 400,
    "medium": 500,
    "semi-bold": 600,
    "demi-bold": 600,
    "bold": 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    "black": 900,
    "heavy": 900,
    "extra-black": 950,
    "ultra-black": 950,
};

/** The spec's stroke style keywords: `solid`, `dashed`, `dotted`, … */
export const strokeStyleKeywords: readonly Extract<
    StrokeStyleValue,
    { kind: "keyword" }
>["keyword"][] = ["solid", "dashed", "dotted", "double", "groove", "ridge", "outset", "inset"];

/** How the end of a dash can be drawn: `round`, `butt`, `square`. */
export const lineCaps: readonly ("round" | "butt" | "square")[] = ["round", "butt", "square"];
