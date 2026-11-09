import { describe, expect, it } from "vitest";
import { parsing } from "./parsing.js";

const { read, reasons, refuses } = parsing("transition");

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
            const raw = {
                duration: "200ms",
                delay: { value: 0, unit: "ms" },
                timingFunction: [2, 0, 1, 1],
            };
            expect(reasons(raw)).toStrictEqual([
                [["$value", "duration"], "duration", "string-with-unit"],
                [["$value", "timingFunction", 0], "cubicBezier", "x-out-of-range"],
            ]);
        });
    });
});
