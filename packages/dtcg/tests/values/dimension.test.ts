import { describe, expect, it } from "vitest";
import type { ParseOptions } from "../../src/index.js";
import { parseDimension } from "../../src/values.js";

const lenient: ParseOptions = { ignoreUnknownProperties: true };

function read(raw: unknown, options?: ParseOptions) {
    const result = parseDimension(raw, ["$value"], options);
    if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
    return result.value;
}

function details(raw: unknown, options?: ParseOptions) {
    const result = parseDimension(raw, ["$value"], options);
    if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
    return result.errors.map(({ path, detail }) => ({ path, detail }));
}

function ignored(raw: unknown, options?: ParseOptions) {
    const result = parseDimension(raw, ["$value"], options);
    return result.ignored.map(({ path, detail }) => ({ path, detail }));
}

describe("parseDimension", () => {
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
        it("reads a reference to a whole token as an alias", () => {
            expect(read("{space.small}")).toStrictEqual({ alias: "space.small" });
        });

        it("reads a JSON Pointer as the whole value", () => {
            expect(read({ $ref: "#/base/spacing/$value" })).toStrictEqual({
                pointer: "#/base/spacing/$value",
            });
        });

        it("reads JSON Pointers in place of value and unit, as spec example 36 does", () => {
            expect(
                read({ value: { $ref: "#/base/spacing/$value/value" }, unit: "rem" }),
            ).toStrictEqual({
                value: { pointer: "#/base/spacing/$value/value" },
                unit: "rem",
            });
            expect(read({ value: 32, unit: { $ref: "#/base/spacing/$value/unit" } })).toStrictEqual(
                {
                    value: 32,
                    unit: { pointer: "#/base/spacing/$value/unit" },
                },
            );
        });
    });

    describe("refuses", () => {
        it.for(["16px", "0.5rem", "-4px", ".5rem", "1em"])(
            "the string %s, which earlier drafts allowed",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: { type: "dimension", reason: "string-with-unit", value: raw },
                    },
                ]);
            },
        );

        it.for([16, "16", "wide", null, [16, "px"], true])(
            "%j, which is not a dimension",
            (raw) => {
                expect(details(raw)).toStrictEqual([
                    {
                        path: ["$value"],
                        detail: { type: "dimension", reason: "wrong-shape", value: raw },
                    },
                ]);
            },
        );

        it.for(["em", "%", "vw", "PX", ""])(
            "the unit %j, which the spec does not allow",
            (unit) => {
                expect(details({ value: 1, unit })).toStrictEqual([
                    {
                        path: ["$value", "unit"],
                        detail: {
                            type: "dimension",
                            reason: "unit-not-allowed",
                            unit,
                            allowed: ["px", "rem"],
                        },
                    },
                ]);
            },
        );

        it("a unit left out, even when the value is 0, as spec 8.2.1 says", () => {
            expect(details({ value: 0 })).toStrictEqual([
                {
                    path: ["$value", "unit"],
                    detail: { type: "dimension", reason: "missing-property", property: "unit" },
                },
            ]);
        });

        it("a value left out", () => {
            expect(details({ unit: "px" })).toStrictEqual([
                {
                    path: ["$value", "value"],
                    detail: { type: "dimension", reason: "missing-property", property: "value" },
                },
            ]);
        });

        it.for(["16", null])("the value %j, which is not a number", (value) => {
            expect(details({ value, unit: "px" })).toStrictEqual([
                {
                    path: ["$value", "value"],
                    detail: { type: "dimension", reason: "not-a-number", value },
                },
            ]);
        });

        it.for(["value", "unit"])("a curly-brace reference in place of %s", (part) => {
            expect(details({ value: 16, unit: "px", [part]: "{space.small}" })).toStrictEqual([
                {
                    path: ["$value", part],
                    detail: {
                        type: "dimension",
                        reason: "alias-not-allowed-here",
                        reference: "{space.small}",
                    },
                },
            ]);
        });
    });

    describe("a property its type does not define", () => {
        it("makes the value invalid by default, as Format 9.2 says of a composite", () => {
            const raw = { value: 16, unit: "px", fluid: true };
            expect(details(raw)).toStrictEqual([
                {
                    path: ["$value", "fluid"],
                    detail: { type: "dimension", reason: "unknown-property", property: "fluid" },
                },
            ]);
            expect(ignored(raw)).toStrictEqual([]);
        });

        describe("with ignoreUnknownProperties, is set aside and the rest read", () => {
            it("a property the spec does not define", () => {
                const raw = { value: 16, unit: "px", fluid: true };
                expect(read(raw, lenient)).toStrictEqual({ value: 16, unit: "px" });
                expect(ignored(raw, lenient)).toStrictEqual([
                    { path: ["$value", "fluid"], detail: { type: "dimension", property: "fluid" } },
                ]);
            });
        });
    });
});
