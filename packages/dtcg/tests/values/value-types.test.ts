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
const dashed: StrokeStyleValue = { dashArray: [dimension], lineCap: "round" };

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

describe("each type's value, as the public types describe it", () => {
    it.for(tokenTypes)("%s reads back as itself, every part included", (type) => {
        const read = parseValue(type, everyPart[type], { references: false });
        expect(read).toStrictEqual({ ok: true, value: everyPart[type], ignored: [] });
    });
});

const objectTypes = [
    "color",
    "dimension",
    "duration",
    "strokeStyle",
    "border",
    "shadow",
    "gradient",
    "transition",
    "typography",
] as const;

function withExtra(type: (typeof objectTypes)[number]) {
    const written = everyPart[type] as Record<string, unknown> | Record<string, unknown>[];
    if (Array.isArray(written)) {
        const [first, ...rest] = written;
        return { raw: [{ ...first, extra: 1 }, ...rest], at: [0, "extra"] };
    }
    return { raw: { ...written, extra: 1 }, at: ["extra"] };
}

describe("a property its type does not define", () => {
    it.for(objectTypes)(
        "makes a %s invalid by default, as Format 9.2 says of a composite",
        (type) => {
            const { raw, at } = withExtra(type);
            const read = parseValue(type, raw, { references: false });
            expect(
                read.ok ? [] : read.errors.map(({ jsonPath, detail }) => ({ jsonPath, detail })),
            ).toStrictEqual([
                { jsonPath: at, detail: { type, reason: "unknown-property", property: "extra" } },
            ]);
            expect(read.ignored).toStrictEqual([]);
        },
    );

    it.for(objectTypes)(
        "is set aside in a %s with ignoreUnknownProperties, and the rest read",
        (type) => {
            const { raw, at } = withExtra(type);
            const read = parseValue(type, raw, {
                references: false,
                ignoreUnknownProperties: true,
            });
            expect(read.ok && read.value).toStrictEqual(everyPart[type]);
            expect(
                read.ignored.map(({ jsonPath, detail }) => ({ jsonPath, detail })),
            ).toStrictEqual([{ jsonPath: at, detail: { type, property: "extra" } }]);
        },
    );
});
