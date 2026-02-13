import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../../src/constants/error-messages";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateShadow } from "../../src/validators/shadow";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("shadow validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/shadow/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/shadow/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate basic shadow", () => {
            const token = validTokens["shadow.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateShadow, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate shadow with inset", () => {
            const token = validTokens["shadow.with.inset"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateShadow, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate multiple shadows", () => {
            const token = validTokens["shadow.multiple"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateShadow, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        describe("structure validation", () => {
            it("should reject non-object values", () => {
                const token = invalidTokens["shadow.invalid.type"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateShadow, token);
                ValidationHelper.expectInvalidShadowError(errors, token.$value, token.$path);
            });
        });

        describe("color validation", () => {
            it("should reject invalid color values", () => {
                const token = invalidTokens["shadow.invalid.color"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateShadow, token);
                ValidationHelper.expectInvalidColorError(
                    errors,
                    (token.$value as { color: string }).color,
                    `${token.$path}.color`
                );
            });
        });

        describe("dimension validation", () => {
            it("should reject invalid dimension units", () => {
                const token = invalidTokens["shadow.invalid.dimension.unit"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateShadow, token);
                ValidationHelper.expectInvalidUnitError(
                    errors,
                    "em",
                    `${token.$path}.offsetX.unit`
                );
            });

            it("should reject invalid dimension values", () => {
                const token = invalidTokens["shadow.invalid.dimension.value"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateShadow, token);
                ValidationHelper.expectInvalidNumberError(
                    errors,
                    "zero",
                    `${token.$path}.offsetX.value`
                );
            });
        });

        describe("required properties", () => {
            it("should reject missing required properties", () => {
                const token = invalidTokens["shadow.missing.required"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateShadow, token);
                ValidationHelper.expectMultipleErrors(errors, 3); // Missing offsetY, blur, and spread
                expect(errors[0]?.message).toBe(
                    ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("offsetY", token.$path)
                );
                expect(errors[1]?.message).toBe(
                    ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("blur", token.$path)
                );
                expect(errors[2]?.message).toBe(
                    ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("spread", token.$path)
                );
            });
        });

        describe("inset validation", () => {
            it("should reject invalid inset values", () => {
                const token = invalidTokens["shadow.invalid.inset"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateShadow, token);
                ValidationHelper.expectInvalidShadowInsetError(
                    errors,
                    (token.$value as { inset: unknown }).inset,
                    `${token.$path}.inset`
                );
            });
        });
    });
});
