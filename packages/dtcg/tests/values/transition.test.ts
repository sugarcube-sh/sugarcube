import { describe, expect, it } from "vitest";
import { parseTransition } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseTransition(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseTransition(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

const emphasis = {
    duration: { value: 200, unit: "ms" },
    delay: { value: 0, unit: "ms" },
    timingFunction: [0.5, 0, 1, 1],
};

describe("parseTransition", () => {
    describe("reads", () => {
        it("the emphasis transition from spec example 53", () => {
            expect(read(emphasis)).toStrictEqual(emphasis);
        });

        it.for(["duration", "delay", "timingFunction"])("a reference in place of %s", (part) => {
            expect(read({ ...emphasis, [part]: `{motion.${part}}` })).toMatchObject({
                [part]: { alias: `motion.${part}` },
            });
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{transition.emphasis}")).toStrictEqual({ alias: "transition.emphasis" });
        });
    });

    describe("refuses", () => {
        it.for(["200ms ease-in", null, [emphasis]])("%j, which is not a transition", (raw) => {
            expect(details(raw)).toStrictEqual([{ path: ["$value"], detail: "wrong-shape" }]);
        });

        it.for(["duration", "delay", "timingFunction"])(
            "a transition with no %s, rather than filling in a default, since spec 9.5 requires all three",
            (part) => {
                const raw: Record<string, unknown> = { ...emphasis };
                delete raw[part];
                expect(details(raw)).toStrictEqual([
                    { path: ["$value"], detail: "missing-property" },
                ]);
            },
        );

        it("a part the spec does not define", () => {
            expect(details({ ...emphasis, property: "opacity" })).toStrictEqual([
                { path: ["$value", "property"], detail: "unknown-property" },
            ]);
        });

        it("each bad part, with its own parser's reason, at its full path", () => {
            expect(
                details({
                    duration: "200ms",
                    delay: { value: 0, unit: "ms" },
                    timingFunction: [2, 0, 1, 1],
                }),
            ).toStrictEqual([
                { path: ["$value", "duration"], detail: "string-with-unit" },
                { path: ["$value", "timingFunction", 0], detail: "x-out-of-range" },
            ]);
        });
    });
});
