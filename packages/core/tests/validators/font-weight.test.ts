import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateFontWeight } from "../../src/validators/font-weight";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("font weight validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/font-weight/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/font-weight/invalid.json"
    );

    describe("valid cases", () => {
        describe("numeric weights", () => {
            it("should validate thin weight (100)", () => {
                const token = validTokens["font.weight.numeric.thin"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectNoErrors(errors);
            });

            it("should validate normal weight (400)", () => {
                const token = validTokens["font.weight.numeric.normal"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectNoErrors(errors);
            });

            it("should validate bold weight (700)", () => {
                const token = validTokens["font.weight.numeric.bold"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectNoErrors(errors);
            });
        });

        describe("keyword weights", () => {
            it("should validate thin keyword", () => {
                const token = validTokens["font.weight.keyword.thin"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectNoErrors(errors);
            });

            it("should validate normal keyword", () => {
                const token = validTokens["font.weight.keyword.normal"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectNoErrors(errors);
            });

            it("should validate bold keyword", () => {
                const token = validTokens["font.weight.keyword.bold"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectNoErrors(errors);
            });
        });
    });

    describe("invalid cases", () => {
        describe("range validation", () => {
            it("should reject values below 1", () => {
                const token = invalidTokens["font.weight.invalid.range.low"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectInvalidFontWeightError(errors, token.$value, token.$path);
            });

            it("should reject values above 1000", () => {
                const token = invalidTokens["font.weight.invalid.range.high"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectInvalidFontWeightError(errors, token.$value, token.$path);
            });
        });

        describe("keyword validation", () => {
            it("should reject invalid keyword values", () => {
                const token = invalidTokens["font.weight.invalid.keyword"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectInvalidFontWeightError(errors, token.$value, token.$path);
            });
        });

        describe("type validation", () => {
            it("should reject boolean values", () => {
                const token = invalidTokens["font.weight.invalid.type.boolean"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectInvalidFontWeightError(errors, token.$value, token.$path);
            });

            it("should reject object values", () => {
                const token = invalidTokens["font.weight.invalid.type.object"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectInvalidFontWeightError(errors, token.$value, token.$path);
            });

            it("should reject array values", () => {
                const token = invalidTokens["font.weight.invalid.type.array"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFontWeight, token);
                ValidationHelper.expectInvalidFontWeightError(errors, token.$value, token.$path);
            });
        });
    });
});
