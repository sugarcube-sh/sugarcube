import { describe, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateCubicBezier } from "../../src/validators/cubic-bezier";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("cubic bezier validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/cubic-bezier/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/cubic-bezier/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate linear easing", () => {
            const token = validTokens["easing.linear"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate ease-in easing", () => {
            const token = validTokens["easing.ease-in"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate ease-out easing", () => {
            const token = validTokens["easing.ease-out"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        it("should reject non-array values", () => {
            const token = invalidTokens["easing.invalid.type"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectInvalidCubicBezierError(errors, token.$value, token.$path);
        });

        it("should reject values outside [0,1] range", () => {
            const token = invalidTokens["easing.invalid.range"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectInvalidCubicBezierError(errors, token.$value, token.$path);
        });

        it("should reject arrays with incorrect length", () => {
            const token = invalidTokens["easing.invalid.length"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectInvalidCubicBezierError(errors, token.$value, token.$path);
        });

        it("should reject arrays with non-number elements", () => {
            const token = invalidTokens["easing.invalid.element-type"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateCubicBezier, token);
            ValidationHelper.expectInvalidCubicBezierError(errors, token.$value, token.$path);
        });
    });
});
