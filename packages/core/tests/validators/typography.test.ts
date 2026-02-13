import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../../src/constants/error-messages";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateTypography } from "../../src/validators/typography";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("typography validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/typography/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/typography/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate basic typography", () => {
            const token = validTokens["typography.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate complete typography", () => {
            const token = validTokens["typography.complete"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        it("should reject non-object values", () => {
            const token = invalidTokens["typography.invalid.type"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectInvalidTypographyError(errors, token.$value, token.$path);
        });

        it("should reject missing required properties", () => {
            const token = invalidTokens["typography.missing.required"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectMissingPropertyError(errors, "fontSize", token.$path);
        });

        it("should reject invalid font family", () => {
            const token = invalidTokens["typography.invalid.font.family"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectInvalidFontFamilyError(
                errors,
                (token.$value as any).fontFamily,
                `${token.$path}.fontFamily`
            );
        });

        it("should reject invalid font size", () => {
            const token = invalidTokens["typography.invalid.font.size"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            expect(errors).toHaveLength(2);
            expect(errors[0]?.message).toBe(
                ErrorMessages.VALIDATE.INVALID_NUMBER(
                    (token.$value as any).fontSize.value,
                    `${token.$path}.fontSize.value`
                )
            );
            expect(errors[1]?.message).toBe(
                ErrorMessages.VALIDATE.INVALID_DIMENSION_UNIT(
                    (token.$value as any).fontSize.unit,
                    `${token.$path}.fontSize.unit`
                )
            );
        });

        it("should reject invalid letter spacing", () => {
            const token = invalidTokens["typography.invalid.letter.spacing"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectInvalidDimensionError(
                errors,
                (token.$value as any).letterSpacing,
                `${token.$path}.letterSpacing`
            );
        });

        it("should reject invalid line height", () => {
            const token = invalidTokens["typography.invalid.line.height"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTypography, token);
            ValidationHelper.expectInvalidNumberError(
                errors,
                (token.$value as any).lineHeight,
                `${token.$path}.lineHeight`
            );
        });
    });
});
