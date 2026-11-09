import { describe, expect, it } from "vitest";
import { parsing } from "./parsing.js";

const { read, refuses } = parsing("duration");

describe("parseValue, duration", () => {
    describe("reads", () => {
        it.for([
            { value: 100, unit: "ms" },
            { value: 1.5, unit: "s" },
            { value: 0, unit: "ms" },
        ])("$value $unit", (duration) => {
            expect(read(duration)).toStrictEqual(duration);
        });

        it("reads a JSON Pointer in place of the value", () => {
            expect(
                read({ value: { $ref: "#/duration/fast/$value/value" }, unit: "s" }),
            ).toStrictEqual({
                value: { syntax: "json-pointer", pointer: "#/duration/fast/$value/value" },
                unit: "s",
            });
        });
    });

    describe("refuses", () => {
        it.for([
            ["200ms", 200, "ms"],
            ["1.5s", 1.5, "s"],
        ] as const)("the string %s, which earlier drafts allowed", ([raw, value, unit]) => {
            refuses(raw, [], { reason: "string-with-unit", value: raw, asObject: { value, unit } });
        });

        it.for([200, "fast", null])("%j, which is not a duration", (raw) => {
            refuses(raw, [], { reason: "wrong-shape", value: raw });
        });

        it.for(["px", "min", "MS"])("the unit %j, which the spec does not allow", (unit) => {
            refuses({ value: 1, unit }, ["unit"], {
                reason: "unit-not-allowed",
                unit,
                allowed: ["ms", "s"],
            });
        });

        it("a value that is not a number", () => {
            refuses({ value: "200", unit: "ms" }, ["value"], {
                reason: "not-a-number",
                value: "200",
            });
        });
    });
});
