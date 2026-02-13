import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/constants/error-messages";
import type { ArraySchema, ObjectSchema, SimpleSchema, UnionSchema } from "../src/types/schema";
import type { ValidationError } from "../src/types/validate";
import { validateSchema } from "../src/validators/schema-validator";

const testSource = { sourcePath: "test.json" };

const validate = (
    schema: SimpleSchema | ObjectSchema | UnionSchema | ArraySchema,
    value: unknown,
    path = "test"
): ValidationError[] => validateSchema(schema, value, path, testSource);

const customError = (path: string, message: string): ValidationError[] => [
    { path, message, source: testSource },
];

describe("schema validator", () => {
    describe("simple values", () => {
        const stringSchema: SimpleSchema = {
            type: "string",
            validate: (value, path) =>
                value === "invalid" ? customError(path, "Custom error") : [],
        };

        it("validates matching types", () => {
            expect(validate(stringSchema, "valid")).toHaveLength(0);
        });

        it("errors on type mismatch", () => {
            const errors = validate(stringSchema, 123);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.VALIDATE.INVALID_TYPE("string", 123, "test")
            );
        });

        it("runs custom validation", () => {
            const errors = validate(stringSchema, "invalid");
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe("Custom error");
        });
    });

    describe("object validation", () => {
        const objectSchema: ObjectSchema = {
            type: "object",
            properties: {
                required: { type: "string" },
                optional: { type: "number" },
            },
            required: ["required"],
        };

        it("validates valid objects", () => {
            expect(validate(objectSchema, { required: "value", optional: 123 })).toHaveLength(0);
        });

        it("errors on missing required properties", () => {
            const errors = validate(objectSchema, { optional: 123 });
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("required", "test")
            );
        });

        it("errors on nested property type mismatches", () => {
            const errors = validate(objectSchema, { required: 123, optional: "wrong" });
            expect(errors).toHaveLength(2);
        });
    });

    describe("union types", () => {
        const unionSchema: UnionSchema = {
            type: "union",
            oneOf: [
                { type: "string" },
                { type: "object", properties: { value: { type: "number" } } },
            ],
        };

        it("validates when any branch matches", () => {
            expect(validate(unionSchema, "string")).toHaveLength(0);
            expect(validate(unionSchema, { value: 123 })).toHaveLength(0);
        });

        it("errors when no branch matches", () => {
            const errors = validate(unionSchema, 123);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("string or object");
        });
    });

    describe("array validation", () => {
        const arraySchema: ArraySchema = {
            type: "array",
            validate: (value, path) =>
                Array.isArray(value) && value.length === 0
                    ? customError(path, "Cannot be empty")
                    : [],
        };

        it("validates non-empty arrays", () => {
            expect(validate(arraySchema, [1, 2, 3])).toHaveLength(0);
        });

        it("runs custom validation on empty arrays", () => {
            const errors = validate(arraySchema, []);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe("Cannot be empty");
        });
    });

    describe("reference handling", () => {
        it("bypasses validation for reference strings", () => {
            expect(validate({ type: "string" }, "{some.reference}")).toHaveLength(0);
        });
    });

    describe("color validation", () => {
        const hexColorSchema: SimpleSchema = {
            type: "string",
            validate: (value, path) =>
                typeof value === "string" && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(value)
                    ? customError(path, "Invalid hex color")
                    : [],
        };

        const w3cColorSchema: ObjectSchema = {
            type: "object",
            required: ["colorSpace", "components"],
            properties: {
                colorSpace: { type: "string" },
                components: { type: "array" },
                alpha: { type: "number" },
                hex: { type: "string" },
            },
            validate: (value, path) => {
                if (typeof value !== "object" || value === null) return [];
                const obj = value as { colorSpace?: unknown; components?: unknown };
                if (obj.colorSpace !== "oklch" || !Array.isArray(obj.components)) {
                    return customError(path, "Invalid DTCG color");
                }
                return [];
            },
        };

        const colorSchema: UnionSchema = {
            type: "union",
            oneOf: [hexColorSchema, w3cColorSchema],
        };

        it("validates hex colors", () => {
            expect(validate(colorSchema, "#ff0000")).toHaveLength(0);
            expect(validate(colorSchema, "#ff0000ff")).toHaveLength(0);
        });

        it("validates DTCG color objects", () => {
            const w3cColor = {
                colorSpace: "oklch",
                components: [0.5, 0.2, 250],
                alpha: 1,
                hex: "#ff0000",
            };
            expect(validate(colorSchema, w3cColor)).toHaveLength(0);
        });

        it("rejects invalid hex colors", () => {
            const errors = validate(colorSchema, "#invalid");
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe("Invalid hex color");
        });

        it("rejects DTCG color objects with wrong property types", () => {
            const invalidW3cColor = {
                colorSpace: "invalid",
                components: "not-an-array",
            };
            const errors = validate(colorSchema, invalidW3cColor);
            // Property validation catches the type error before custom validation runs
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Expected array");
        });

        it("rejects DTCG color objects with invalid values (custom validation)", () => {
            // Structure is valid, but values fail custom validation
            const invalidColorSpace = {
                colorSpace: "srgb",
                components: [255, 0, 0],
            };
            const errors = validate(colorSchema, invalidColorSpace);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe("Invalid DTCG color");
        });
    });
});
