import type { LineCap, StrokeStyleKeyword } from "../../types/dtcg.js";

export const TOKEN_REFERENCE = /\{([^{}]+)\}/g;

export const FONT_WEIGHT_ALIASES: Record<string, number> = {
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

export const STROKE_STYLE_KEYWORDS: readonly StrokeStyleKeyword[] = [
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
];

export const LINE_CAPS: readonly LineCap[] = ["round", "butt", "square"];
