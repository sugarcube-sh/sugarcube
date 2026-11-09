import { describe, expect, it } from "vitest";
import { parsing } from "./parsing.js";

const { read, refuses } = parsing("dimension");

describe("parseValue, dimension", () => {
    describe("reads", () => {
        it.for([
            { value: 0, unit: "px" },
            { value: 0.5, unit: "rem" },
            { value: 16, unit: "px" },
            { value: -4, unit: "px" },
        ])("$value $unit", (dimension) => {
            expect(read(dimension)).toStrictEqual(dimension);
        });
    });

    describe("references", () => {
        it("reads JSON Pointers in place of value and unit, as spec example 36 does", () => {
            expect(
                read({ value: { $ref: "#/base/spacing/$value/value" }, unit: "rem" }),
            ).toStrictEqual({
                value: { syntax: "json-pointer", pointer: "#/base/spacing/$value/value" },
                unit: "rem",
            });
            expect(read({ value: 32, unit: { $ref: "#/base/spacing/$value/unit" } })).toStrictEqual(
                {
                    value: 32,
                    unit: { syntax: "json-pointer", pointer: "#/base/spacing/$value/unit" },
                },
            );
        });
    });

    describe("refuses", () => {
        it.for([
            ["16px", 16, "px"],
            ["0.5rem", 0.5, "rem"],
            ["-4px", -4, "px"],
            [".5rem", 0.5, "rem"],
        ] as const)("the string %s, which earlier drafts allowed", ([raw, value, unit]) => {
            refuses(raw, [], { reason: "string-with-unit", value: raw, asObject: { value, unit } });
        });

        it("the string 1em, with no object to give, since a dimension cannot use em", () => {
            refuses("1em", [], { reason: "string-with-unit", value: "1em" });
        });

        it.for([16, "16", "wide", null, [16, "px"], true])(
            "%j, which is not a dimension",
            (raw) => {
                refuses(raw, [], { reason: "wrong-shape", value: raw });
            },
        );

        it.for(["em", "%", "vw", "PX", ""])(
            "the unit %j, which the spec does not allow",
            (unit) => {
                refuses({ value: 1, unit }, ["unit"], {
                    reason: "unit-not-allowed",
                    unit,
                    allowed: ["px", "rem"],
                });
            },
        );

        it("a unit left out, even when the value is 0, as spec 8.2.1 says", () => {
            refuses({ value: 0 }, ["unit"], { reason: "missing-property", property: "unit" });
        });

        it("a value left out", () => {
            refuses({ unit: "px" }, ["value"], { reason: "missing-property", property: "value" });
        });

        it.for(["16", null])("the value %j, which is not a number", (value) => {
            refuses({ value, unit: "px" }, ["value"], { reason: "not-a-number", value });
        });

        it.for(["value", "unit"])("a curly-brace reference in place of %s", (part) => {
            refuses({ value: 16, unit: "px", [part]: "{space.small}" }, [part], {
                reason: "curly-brace-not-allowed-here",
                reference: "{space.small}",
            });
        });
    });
});
