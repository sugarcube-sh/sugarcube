import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateFluidDimension } from "../../src/validators/fluid-dimension";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("fluid dimension validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/fluid-dimension/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/fluid-dimension/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate correct px fluid dimension", () => {
            const token = validTokens["spacing.fluid.1"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateFluidDimension, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate correct rem fluid dimension", () => {
            const token = validTokens["spacing.fluid.2"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateFluidDimension, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        describe("structure validation", () => {
            it("should reject string value", () => {
                const token = invalidTokens["spacing.fluid.invalid.structure.string"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFluidDimension, token);
                ValidationHelper.expectInvalidFluidDimensionError(
                    errors,
                    token.$value,
                    token.$path
                );
            });

            it("should reject array value", () => {
                const token = invalidTokens["spacing.fluid.invalid.structure.array"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFluidDimension, token);
                ValidationHelper.expectInvalidFluidDimensionError(
                    errors,
                    token.$value,
                    token.$path
                );
            });
        });

        describe("property validation", () => {
            it("should reject missing min property", () => {
                const token = invalidTokens["spacing.fluid.invalid.missing-min"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFluidDimension, token);
                ValidationHelper.expectMissingPropertyError(errors, "min", token.$path);
            });

            it("should reject missing max property", () => {
                const token = invalidTokens["spacing.fluid.invalid.missing-max"];
                if (!token) throw new Error("Token not found");
                const errors = ValidationHelper.validateToken(validateFluidDimension, token);
                ValidationHelper.expectMissingPropertyError(errors, "max", token.$path);
            });

            describe("dimension validation", () => {
                it("should reject invalid min value type", () => {
                    const token = invalidTokens["spacing.fluid.invalid.min-value"];
                    if (!token) throw new Error("Token not found");
                    const errors = ValidationHelper.validateToken(validateFluidDimension, token);
                    ValidationHelper.expectInvalidNumberError(
                        errors,
                        "16",
                        `${token.$path}.min.value`
                    );
                });

                it("should reject invalid max unit", () => {
                    const token = invalidTokens["spacing.fluid.invalid.max-unit"];
                    if (!token) throw new Error("Token not found");
                    const errors = ValidationHelper.validateToken(validateFluidDimension, token);
                    ValidationHelper.expectInvalidUnitError(
                        errors,
                        "invalid",
                        `${token.$path}.max.unit`
                    );
                });
            });
        });
    });
});
