import { describe, expect, it } from "vitest";
import type { FlattenedToken } from "../../src/types/flatten";
import { validateColor } from "../../src/validators/color";
import { loadFixture } from "../__fixtures__/helpers/load-fixture";
import { ValidationHelper } from "../__fixtures__/helpers/validation-helper";

describe("color validator", () => {
    const validTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/color/valid.json"
    );
    const invalidTokens = loadFixture<Record<string, FlattenedToken>>(
        "tokens/validators/color/invalid.json"
    );

    describe("valid cases", () => {
        it("should validate hex RGB color", () => {
            const token = validTokens["color.hex.rgb"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate hex RGBA color", () => {
            const token = validTokens["color.hex.rgba"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate hex blue color", () => {
            const token = validTokens["color.hex.blue"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate OKLCH color", () => {
            const token = validTokens["color.oklch.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate OKLCH color with alpha", () => {
            const token = validTokens["color.oklch.with-alpha"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate OKLCH color with 'none' component", () => {
            const token = validTokens["color.oklch.with-none"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate Display P3 color", () => {
            const token = validTokens["color.display-p3.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate Display P3 color with hex fallback", () => {
            const token = validTokens["color.display-p3.with-hex"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate sRGB color", () => {
            const token = validTokens["color.srgb.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate sRGB color with alpha", () => {
            const token = validTokens["color.srgb.with-alpha"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate HSL color", () => {
            const token = validTokens["color.hsl.basic"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });

        it("should validate HSL color with 'none' component", () => {
            const token = validTokens["color.hsl.with-none"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectNoErrors(errors);
        });
    });

    describe("invalid cases", () => {
        it("should reject invalid hex length", () => {
            const token = invalidTokens["color.invalid.short"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectInvalidColorError(errors, "#ff0", token.$path);
        });

        it("should reject non-hex characters", () => {
            const token = invalidTokens["color.invalid.chars"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectInvalidColorError(errors, "#gh00ff", token.$path);
        });

        it("should reject missing hash", () => {
            const token = invalidTokens["color.invalid.no-hash"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectInvalidColorError(errors, "ff0000", token.$path);
        });

        it("should reject non-string values", () => {
            const token = invalidTokens["color.invalid.type"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                "Expected string or object, received number at color.invalid.type"
            );
        });

        it("should reject invalid DTCG color space", () => {
            const token = invalidTokens["color.invalid.w3c.colorspace"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectInvalidColorError(errors, token.$value as string, token.$path);
        });

        it("should reject DTCG color missing colorSpace", () => {
            const token = invalidTokens["color.invalid.w3c.missing-colorspace"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                "Missing required property 'colorSpace' at color.invalid.w3c.missing-colorspace"
            );
        });

        it("should reject DTCG color missing components", () => {
            const token = invalidTokens["color.invalid.w3c.missing-components"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                "Missing required property 'components' at color.invalid.w3c.missing-components"
            );
        });

        it("should reject DTCG color with wrong component count", () => {
            const token = invalidTokens["color.invalid.w3c.wrong-component-count"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectInvalidColorError(errors, token.$value as string, token.$path);
        });

        it("should reject DTCG color with invalid component type", () => {
            const token = invalidTokens["color.invalid.w3c.invalid-component-type"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            ValidationHelper.expectInvalidColorError(errors, token.$value as string, token.$path);
        });

        it("should reject DTCG color with invalid alpha", () => {
            const token = invalidTokens["color.invalid.w3c.invalid-alpha"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                "Expected number, received string at color.invalid.w3c.invalid-alpha.alpha"
            );
        });

        it("should reject OKLCH color with out-of-range values", () => {
            const token = invalidTokens["color.invalid.w3c.oklch-out-of-range"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(3);
            expect(errors[0]?.message).toContain(
                "Invalid color at color.invalid.w3c.oklch-out-of-range:"
            );
        });

        it("should reject Display P3 color with out-of-range values", () => {
            const token = invalidTokens["color.invalid.w3c.display-p3-out-of-range"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(3);
            expect(errors[0]?.message).toContain(
                "Invalid color at color.invalid.w3c.display-p3-out-of-range:"
            );
        });

        it("should reject color with alpha out of range", () => {
            const token = invalidTokens["color.invalid.w3c.alpha-out-of-range"];
            if (!token) throw new Error("Token not found");
            const errors = ValidationHelper.validateToken(validateColor, token);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain(
                "Invalid color at color.invalid.w3c.alpha-out-of-range:"
            );
        });
    });
});
