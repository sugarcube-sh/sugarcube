import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateDuration } from "../../src/validators/duration";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("duration validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/duration/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/duration/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate correct ms duration", () => {
            const token = validTokens["duration.fast"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDuration, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate correct s duration", () => {
            const token = validTokens["duration.slow"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateDuration, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        describe("structure validation", () => {
            it("should reject string value", () => {
                const token = invalidTokens["duration.invalid.structure.string"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateDuration, token);
                ValidationHelper.expectInvalidDurationError(errors, token.$value, token.$path);
            });

            it("should reject array value", () => {
                const token = invalidTokens["duration.invalid.structure.array"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateDuration, token);
                ValidationHelper.expectInvalidDurationError(errors, token.$value, token.$path);
            });
        });

        describe("property validation", () => {
            it("should reject invalid unit", () => {
                const token = invalidTokens["duration.invalid.unit"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateDuration, token);
                ValidationHelper.expectInvalidDurationUnitError(
                    errors,
                    "mins",
                    `${token.$path}.unit`
                );
            });

            it("should reject non-numeric value", () => {
                const token = invalidTokens["duration.invalid.value"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateDuration, token);
                ValidationHelper.expectInvalidNumberError(errors, "300", `${token.$path}.value`);
            });

            it("should reject missing properties", () => {
                const token = invalidTokens["duration.invalid.missing-unit"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateDuration, token);
                ValidationHelper.expectMissingPropertyError(errors, "unit", token.$path);
            });
        });
    });
});
