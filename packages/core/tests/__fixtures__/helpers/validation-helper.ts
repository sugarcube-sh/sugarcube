import { expect } from "vitest";
import { ErrorMessages } from "../../../src/constants/error-messages";
import type { TokenSource } from "../../../src/types/tokens";
import type { ValidationError } from "../../../src/types/validate";

export const ValidationHelper = {
    validateToken(
        validator: (value: unknown, path: string, source: TokenSource) => ValidationError[],
        token: { $value: unknown; $path: string; $source: TokenSource }
    ) {
        return validator(token.$value, token.$path, token.$source);
    },

    expectNoErrors(errors: ValidationError[]) {
        expect(errors).toHaveLength(0);
    },

    expectMissingPropertyError(errors: ValidationError[], property: string, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(
            ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY(property, path)
        );
    },

    expectInvalidUnitError(errors: ValidationError[], unit: string, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_DIMENSION_UNIT(unit, path));
    },

    expectInvalidNumberError(errors: ValidationError[], value: string, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_NUMBER(value, path));
    },

    expectInvalidDimensionError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_DIMENSION(value, path));
    },

    expectInvalidArrayError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_ARRAY(value, path));
    },

    expectInvalidTypeError(
        errors: ValidationError[],
        expected: string,
        value: unknown,
        path: string
    ) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_TYPE(expected, value, path));
    },

    // Border-specific helpers
    expectInvalidColorError(errors: ValidationError[], value: string, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_COLOR(value, path));
    },

    expectInvalidStrokeStyleError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_STROKE_STYLE(value, path));
    },

    expectInvalidStrokeLineCapError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(
            ErrorMessages.VALIDATE.INVALID_STROKE_LINE_CAP(value, path)
        );
    },

    expectMultipleErrors(errors: ValidationError[], expectedLength: number) {
        expect(errors).toHaveLength(expectedLength);
    },

    expectInvalidCubicBezierError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_CUBIC_BEZIER(value, path));
    },

    expectInvalidDurationError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_DURATION(value, path));
    },

    expectInvalidDurationUnitError(errors: ValidationError[], unit: string, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_DURATION_UNIT(unit, path));
    },

    expectInvalidFluidDimensionError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(
            ErrorMessages.VALIDATE.INVALID_FLUID_DIMENSION(value, path)
        );
    },

    expectInvalidFontFamilyError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_FONT_FAMILY(value, path));
    },

    expectInvalidFontWeightError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_FONT_WEIGHT(value, path));
    },

    expectInvalidGradientError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_GRADIENT(value, path));
    },

    expectInvalidGradientStopPositionError(
        errors: ValidationError[],
        value: unknown,
        path: string
    ) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(
            ErrorMessages.VALIDATE.INVALID_GRADIENT_STOP_POSITION(value, path)
        );
    },

    expectInvalidShadowError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_SHADOW(value, path));
    },

    expectInvalidShadowInsetError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_SHADOW_INSET(value, path));
    },

    expectInvalidTypographyError(errors: ValidationError[], value: unknown, path: string) {
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe(ErrorMessages.VALIDATE.INVALID_TYPOGRAPHY(value, path));
    },
};
