import { describe, expect, it } from "vitest";
import { lenient, parsing } from "./parsing.js";

const { read, details, ignored, refuses } = parsing("transition");

const emphasis = {
    duration: { value: 200, unit: "ms" },
    delay: { value: 0, unit: "ms" },
    timingFunction: [0.5, 0, 1, 1],
};

describe("parseValue, transition", () => {
    describe("reads", () => {
        it("the emphasis transition from spec example 53", () => {
            expect(read(emphasis)).toStrictEqual(emphasis);
        });

        it.for(["duration", "delay", "timingFunction"])("a reference in place of %s", (part) => {
            expect(read({ ...emphasis, [part]: `{motion.${part}}` })).toMatchObject({
                [part]: { syntax: "curly-brace", path: `motion.${part}` },
            });
        });

        it("reads a reference to a whole token in curly brace syntax", () => {
            expect(read("{transition.emphasis}")).toStrictEqual({
                syntax: "curly-brace",
                path: "transition.emphasis",
            });
        });
    });

    describe("refuses", () => {
        it.for(["200ms ease-in", null, [emphasis]])("%j, which is not a transition", (raw) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });

        it.for(["duration", "delay", "timingFunction"])(
            "a transition with no %s, rather than filling in a default, since spec 9.5 requires all three",
            (part) => {
                const raw: Record<string, unknown> = { ...emphasis };
                delete raw[part];
                refuses(raw, [part], { reason: "missing-property", property: part });
            },
        );

        it("each bad part, with its own parser's reason, at its full path", () => {
            expect(
                details({
                    duration: "200ms",
                    delay: { value: 0, unit: "ms" },
                    timingFunction: [2, 0, 1, 1],
                }),
            ).toStrictEqual([
                {
                    jsonPath: ["$value", "duration"],
                    detail: {
                        type: "duration",
                        reason: "string-with-unit",
                        value: "200ms",
                        asObject: { value: 200, unit: "ms" },
                    },
                },
                {
                    jsonPath: ["$value", "timingFunction", 0],
                    detail: {
                        type: "cubicBezier",
                        reason: "x-out-of-range",
                        value: 2,
                        coordinate: "x1",
                    },
                },
            ]);
        });
    });

    describe("a property its type does not define", () => {
        it("makes the value invalid by default, as Format 9.2 says of a composite", () => {
            const raw = { ...emphasis, property: "opacity" };
            refuses(raw, ["property"], { reason: "unknown-property", property: "property" });
            expect(ignored(raw)).toStrictEqual([]);
        });

        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a part the spec does not define", () => {
                const raw = { ...emphasis, property: "opacity" };
                expect(read(raw, lenient)).toStrictEqual(read(emphasis, lenient));
                expect(ignored(raw, lenient)).toStrictEqual([
                    {
                        jsonPath: ["$value", "property"],
                        detail: { type: "transition", property: "property" },
                    },
                ]);
            });
        });
    });
});
