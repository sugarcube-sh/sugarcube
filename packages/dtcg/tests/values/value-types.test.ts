import { describe, expect, it } from "vitest";
import type { StrokeStyleValue, TokenType, ValueByType } from "../../src/index.js";
import { parseValue, tokenTypes } from "../../src/values.js";

const color = {
    colorSpace: "display-p3",
    components: [0.2, 0.4, 0.6],
    alpha: 0.5,
    hex: "#336699",
} satisfies ValueByType["color"];
const dimension = { value: 2, unit: "rem" } satisfies ValueByType["dimension"];
const duration = { value: 200, unit: "ms" } satisfies ValueByType["duration"];
const cubicBezier: ValueByType["cubicBezier"] = [0.25, 0.1, 0.25, 1];
const dashed: StrokeStyleValue = { kind: "dash", dashArray: [dimension], lineCap: "round" };

const everyPart: { [T in TokenType]: ValueByType[T] } = {
    color,
    dimension,
    duration,
    cubicBezier,
    number: 1.5,
    fontFamily: ["Inter", "sans-serif"],
    fontWeight: 700,
    strokeStyle: dashed,
    border: { color, width: dimension, style: dashed },
    shadow: [
        {
            color,
            offsetX: dimension,
            offsetY: dimension,
            blur: dimension,
            spread: dimension,
            inset: true,
        },
    ],
    gradient: [{ color, position: 0.5 }],
    transition: { duration, delay: duration, timingFunction: cubicBezier },
    typography: {
        fontFamily: ["Inter"],
        fontSize: dimension,
        fontWeight: 400,
        letterSpacing: dimension,
        lineHeight: 1.2,
    },
};

function asWritten(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(asWritten);
    if (typeof value !== "object" || value === null) return value;
    const entries = Object.entries(value);
    const keyword = entries.find(([key]) => key === "keyword");
    if (keyword) return keyword[1];
    return Object.fromEntries(
        entries.filter(([key]) => key !== "kind").map(([key, part]) => [key, asWritten(part)]),
    );
}

describe("each type's value, as the public types describe it", () => {
    it.for(tokenTypes)("%s reads back as itself, every part included", (type) => {
        const read = parseValue(type, asWritten(everyPart[type]), [], { references: false });
        expect(read).toStrictEqual({ ok: true, value: everyPart[type], ignored: [] });
    });
});
