import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateStrokeStyle } from "../../src/validators/stroke";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("stroke style validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/stroke/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/stroke/invalid.json"
    );

    describe("valid cases", () => {
        describe("keyword values", () => {
            it("should validate solid keyword", () => {
                const token = validTokens["stroke.keyword.solid"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectNoErrors(errors);
            });

            it("should validate dashed keyword", () => {
                const token = validTokens["stroke.keyword.dashed"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectNoErrors(errors);
            });
        });

        describe("custom values", () => {
            it("should validate custom stroke with single dash", () => {
                const token = validTokens["stroke.custom"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectNoErrors(errors);
            });

            it("should validate custom stroke with multiple dashes", () => {
                const token = validTokens["stroke.custom.multiple"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectNoErrors(errors);
            });
        });
    });

    describe("invalid cases", () => {
        describe("keyword validation", () => {
            it("should reject invalid keyword values", () => {
                const token = invalidTokens["stroke.invalid.keyword"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectInvalidStrokeStyleError(errors, token.$value, token.$path);
            });

            it("should reject non-string values", () => {
                const token = invalidTokens["stroke.invalid.type"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectInvalidTypeError(
                    errors,
                    "string or object",
                    token.$value,
                    token.$path
                );
            });
        });

        describe("custom stroke validation", () => {
            it("should reject invalid lineCap values", () => {
                const token = invalidTokens["stroke.invalid.linecap"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectInvalidStrokeLineCapError(
                    errors,
                    (token.$value as { lineCap: string }).lineCap,
                    `${token.$path}.lineCap`
                );
            });

            it("should reject missing required properties", () => {
                const token = invalidTokens["stroke.missing.required"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectMissingPropertyError(errors, "lineCap", token.$path);
            });

            it("should reject invalid dashArray values", () => {
                const token = invalidTokens["stroke.invalid.dasharray"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateStrokeStyle, token);
                ValidationHelper.expectInvalidNumberError(
                    errors,
                    "four",
                    `${token.$path}.dashArray.0.value`
                );
            });
        });
    });
});
