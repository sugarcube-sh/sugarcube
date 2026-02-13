import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateFontFamily } from "../../src/validators/font-family";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("font family validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/font-family/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/font-family/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate single font family", () => {
            const token = validTokens["font.primary"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateFontFamily, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate font stack", () => {
            const token = validTokens["font.stack"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateFontFamily, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        describe("type validation", () => {
            it("should reject numeric value", () => {
                const token = invalidTokens["font.invalid.type.number"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontFamily, token);
                ValidationHelper.expectInvalidFontFamilyError(errors, token.$value, token.$path);
            });

            it("should reject object value", () => {
                const token = invalidTokens["font.invalid.type.object"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontFamily, token);
                ValidationHelper.expectInvalidFontFamilyError(errors, token.$value, token.$path);
            });
        });

        describe("array validation", () => {
            it("should reject array with mixed types", () => {
                const token = invalidTokens["font.invalid.array.mixed"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontFamily, token);
                ValidationHelper.expectInvalidFontFamilyError(errors, token.$value, token.$path);
            });

            it("should reject array of numbers", () => {
                const token = invalidTokens["font.invalid.array.numbers"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontFamily, token);
                ValidationHelper.expectInvalidFontFamilyError(errors, token.$value, token.$path);
            });
        });
    });
});
