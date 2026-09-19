import { describe, it } from "vitest";
import { validateGradient } from "../../src/shared/validators/gradient";
import type { FlattenedToken } from "../../src/types/flatten";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("gradient validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/gradient/valid.json",
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/gradient/invalid.json",
    );

    describe("valid cases", () => {
        it("should validate simple gradient with two stops", () => {
            const token = validTokens["gradient.simple"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateGradient, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate gradient with multiple stops", () => {
            const token = validTokens["gradient.multiple"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateGradient, token);
            ValidationHelper.expectNoErrors(errors);
        });

        // DTCG 2025.10 9.7: a position outside [0, 1] "MUST be considered as if
        // it were clamped", so it is a valid token. renderGradient does the clamping.
        it("should accept positions outside [0, 1] rather than rejecting them", () => {
            const token = validTokens["gradient.position.out.of.range"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateGradient, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        describe("structure validation", () => {
            it("should reject non-array values", () => {
                const token = invalidTokens["gradient.invalid.type"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateGradient, token);
                ValidationHelper.expectInvalidArrayError(errors, token.$value, token.$path);
            });

            it("should reject invalid gradient stop objects", () => {
                const token = invalidTokens["gradient.invalid.stop"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateGradient, token);
                ValidationHelper.expectInvalidGradientError(
                    errors,
                    (token.$value as any[])[0],
                    `${token.$path}[0]`,
                );
            });
        });

        describe("color validation", () => {
            it("should reject invalid color values", () => {
                const token = invalidTokens["gradient.invalid.color"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateGradient, token);
                ValidationHelper.expectInvalidColorError(
                    errors,
                    (token.$value as any[])[0].color,
                    `${token.$path}[0].color`,
                );
            });

            it("should reject missing color property", () => {
                const token = invalidTokens["gradient.missing.color"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateGradient, token);
                ValidationHelper.expectMissingPropertyError(errors, "color", `${token.$path}[0]`);
            });
        });

        describe("position validation", () => {
            it("should reject missing position property", () => {
                const token = invalidTokens["gradient.missing.position"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateGradient, token);
                ValidationHelper.expectMissingPropertyError(
                    errors,
                    "position",
                    `${token.$path}[0]`,
                );
            });
        });
    });
});
