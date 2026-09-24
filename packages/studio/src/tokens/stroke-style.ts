import { STROKE_STYLE_KEYWORDS, type StrokeStyleKeyword } from "@sugarcube-sh/core/client";

export function readStrokeStyle(value: unknown): StrokeStyleKeyword | undefined {
    if (typeof value !== "string") return undefined;
    return STROKE_STYLE_KEYWORDS.includes(value as StrokeStyleKeyword)
        ? (value as StrokeStyleKeyword)
        : undefined;
}
