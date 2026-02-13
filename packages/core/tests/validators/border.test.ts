import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import type { ValidationError } from "../../src/types/validate";
import { validateBorder } from "../../src/validators/border";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("border validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/border/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/border/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate solid border", () => {
            const token = validTokens["border.thin"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate dashed border", () => {
            const token = validTokens["border.thick"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate custom stroke style", () => {
            const token = validTokens["border.custom"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("structure errors", () => {
        it("should reject missing color", () => {
            const token = invalidTokens["border.missing-color"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectMissingPropertyError(errors, "color", token.$path);
        });

        it("should reject missing width", () => {
            const token = invalidTokens["border.missing-width"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectMissingPropertyError(errors, "width", token.$path);
        });

        it("should reject missing style", () => {
            const token = invalidTokens["border.missing-style"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectMissingPropertyError(errors, "style", token.$path);
        });
    });

    describe("property validation errors", () => {
        it("should reject invalid color", () => {
            const token = invalidTokens["border.invalid-color"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectInvalidColorError(errors, "not-a-color", `${token.$path}.color`);
        });

        it("should reject invalid width value", () => {
            const token = invalidTokens["border.invalid-width-value"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectInvalidNumberError(errors, "1", `${token.$path}.width.value`);
        });

        it("should reject invalid width unit", () => {
            const token = invalidTokens["border.invalid-width-unit"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectInvalidUnitError(errors, "em", `${token.$path}.width.unit`);
        });

        it("should reject invalid stroke style keyword", () => {
            const token = invalidTokens["border.invalid-style-keyword"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectInvalidStrokeStyleError(
                errors,
                "invalid",
                `${token.$path}.style`
            );
        });

        it("should reject invalid custom stroke style", () => {
            const token = invalidTokens["border.invalid-custom-style"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateBorder, token);
            ValidationHelper.expectMultipleErrors(errors, 2);
            ValidationHelper.expectInvalidUnitError(
                [errors[0] as ValidationError],
                "em",
                `${token.$path}.style.dashArray.0.unit`
            );
            ValidationHelper.expectInvalidStrokeLineCapError(
                [errors[1] as ValidationError],
                "invalid",
                `${token.$path}.style.lineCap`
            );
        });
    });
});
