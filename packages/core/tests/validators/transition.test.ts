import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateTransition } from "../../src/validators/transition";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("transition validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/transition/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/transition/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate basic transition", () => {
            const token = validTokens["transition.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTransition, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        describe("duration validation", () => {
            it("should reject non-object duration", () => {
                const token = invalidTokens["transition.invalid.duration.type"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateTransition, token);
                ValidationHelper.expectInvalidDurationError(
                    errors,
                    (token.$value as any).duration,
                    `${token.$path}.duration`
                );
            });

            it("should reject invalid duration value type", () => {
                const token = invalidTokens["transition.invalid.duration.value"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateTransition, token);
                ValidationHelper.expectInvalidNumberError(
                    errors,
                    (token.$value as any).duration.value,
                    `${token.$path}.duration.value`
                );
            });

            it("should reject invalid duration unit", () => {
                const token = invalidTokens["transition.invalid.duration.unit"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateTransition, token);
                ValidationHelper.expectInvalidDurationUnitError(
                    errors,
                    (token.$value as any).duration.unit,
                    `${token.$path}.duration.unit`
                );
            });
        });

        it("should reject missing required properties", () => {
            const token = invalidTokens["transition.missing.required"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateTransition, token);
            ValidationHelper.expectMissingPropertyError(errors, "timingFunction", token.$path);
        });
    });
});
