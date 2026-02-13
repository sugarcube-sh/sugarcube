import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateDimension } from "../../src/validators/dimension";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("dimension validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/dimension/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/dimension/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate pixel dimensions", () => {
            const token = validTokens["spacing.small"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate rem dimensions", () => {
            const token = validTokens["spacing.medium"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should bypass validation for references", () => {
            const token = validTokens["spacing.reference"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        it("should reject invalid units", () => {
            const token = invalidTokens["spacing.invalid.unit"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectInvalidUnitError(errors, "em", `${token.$path}.unit`);
        });

        it("should reject missing unit", () => {
            const token = invalidTokens["spacing.invalid.missing-unit"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectMissingPropertyError(errors, "unit", token.$path);
        });

        it("should reject invalid value type", () => {
            const token = invalidTokens["spacing.invalid.value"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectInvalidNumberError(errors, "10", `${token.$path}.value`);
        });

        it("should reject invalid structure", () => {
            const token = invalidTokens["spacing.invalid.structure"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDimension, token);
            ValidationHelper.expectInvalidDimensionError(errors, token.$value, token.$path);
        });
    });
});
