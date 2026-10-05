import { describe, expect, it } from "vitest";
import { parseDuration } from "../../src/values.js";

function read(raw: unknown) {
    const result = parseDuration(raw, ["$value"]);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown) {
    const result = parseDuration(raw, ["$value"]);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

function ignored(raw: unknown) {
    const result = parseDuration(raw, ["$value"]);
    return (result.ignored ?? []).map(({ path, detail }) => ({ path, detail }));
}

describe("parseDuration", () => {
    describe("reads", () => {
        it.for([
            { value: 100, unit: "ms" },
            { value: 1.5, unit: "s" },
            { value: 0, unit: "ms" },
        ])("$value $unit", (duration) => {
            expect(read(duration)).toStrictEqual(duration);
        });

        it("reads a reference to a whole token as an alias", () => {
            expect(read("{duration.fast}")).toStrictEqual({ alias: "duration.fast" });
        });

        it("reads a JSON Pointer in place of the value", () => {
            expect(
                read({ value: { $ref: "#/duration/fast/$value/value" }, unit: "s" }),
            ).toStrictEqual({
                value: { pointer: "#/duration/fast/$value/value" },
                unit: "s",
            });
        });
    });

    describe("refuses", () => {
        it.for(["200ms", "1.5s"])("the string %s, which earlier drafts allowed", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "duration", reason: "string-with-unit", value: raw },
                },
            ]);
        });

        it.for([200, "fast", null])("%j, which is not a duration", (raw) => {
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value"],
                    detail: { type: "duration", reason: "wrong-shape", value: raw },
                },
            ]);
        });

        it.for(["px", "min", "MS"])("the unit %j, which the spec does not allow", (unit) => {
            expect(details({ value: 1, unit })).toStrictEqual([
                {
                    path: ["$value", "unit"],
                    detail: {
                        type: "duration",
                        reason: "unit-not-allowed",
                        unit,
                        allowed: ["ms", "s"],
                    },
                },
            ]);
        });

        it("a value that is not a number", () => {
            expect(details({ value: "200", unit: "ms" })).toStrictEqual([
                {
                    path: ["$value", "value"],
                    detail: { type: "duration", reason: "not-a-number", value: "200" },
                },
            ]);
        });
    });

    describe("sets aside a property its type does not define, and reads the rest", () => {
        it("a property the spec does not define", () => {
            const raw = { value: 200, unit: "ms", easing: "ease" };
            expect(read(raw)).toStrictEqual({ value: 200, unit: "ms" });
            expect(ignored(raw)).toStrictEqual([
                { path: ["$value", "easing"], detail: { type: "duration", property: "easing" } },
            ]);
        });
    });
});
