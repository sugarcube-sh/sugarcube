import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/constants/error-messages";
import { validate } from "../src/pipeline/validate";
import type { FlattenedTokens } from "../src/types/flatten";

describe("validate", () => {
    describe("token structure", () => {
        it("should validate tokens with required fields", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    "default.color.primary": {
                        $type: "color",
                        $value: "#0066cc",
                        $path: "color.primary",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "color.primary",
                    },
                },
                pathIndex: new Map([["color.primary", "default.color.primary"]]),
            };
            const errors = validate(tokens);
            expect(errors).toHaveLength(0);
        });

        it("should detect missing required fields", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    // @ts-expect-error - it's missing the $value field
                    "default.color.invalid": {
                        $type: "color",
                        $path: "color.invalid",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "color.invalid",
                    },
                },
                pathIndex: new Map([["color.invalid", "default.color.invalid"]]),
            };
            const errors = validate(tokens);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.VALIDATE.MISSING_REQUIRED_PROPERTY("$value", "color.invalid")
            );
        });

        it("should detect unknown token types", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    "default.unknown.invalid": {
                        // @ts-expect-error - it's an unknown token type
                        $type: "not-a-real-type",
                        $value: "some value",
                        $path: "unknown.invalid",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "unknown.invalid",
                    },
                },
                pathIndex: new Map([["unknown.invalid", "default.unknown.invalid"]]),
            };
            const errors = validate(tokens);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toBe(
                ErrorMessages.VALIDATE.UNKNOWN_TOKEN_TYPE("not-a-real-type", "unknown.invalid")
            );
        });
    });

    describe("error aggregation", () => {
        it("should collect errors from multiple tokens", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    "default.color.invalid": {
                        $type: "color",
                        $value: "not-a-color",
                        $path: "color.invalid",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "color.invalid",
                    },
                    "default.dimension.invalid": {
                        $type: "dimension",
                        $value: "not-a-dimension",
                        $path: "dimension.invalid",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "dimension.invalid",
                    },
                },
                pathIndex: new Map([
                    ["color.invalid", "default.color.invalid"],
                    ["dimension.invalid", "default.dimension.invalid"],
                ]),
            };
            const errors = validate(tokens);
            expect(errors).toHaveLength(2);
            expect(errors[0]?.path).toBe("color.invalid");
            expect(errors[1]?.path).toBe("dimension.invalid");
        });

        it("should preserve error source information", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    "default.color.invalid": {
                        $type: "color",
                        $value: "not-a-color",
                        $path: "color.invalid",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "color.invalid",
                    },
                },
                pathIndex: new Map([["color.invalid", "default.color.invalid"]]),
            };
            const errors = validate(tokens);
            expect(errors[0]?.source).toEqual({
                sourcePath: "test.json",
            });
        });
    });

    describe("metadata handling", () => {
        it("should preserve metadata during validation", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    "default.color.withMetadata.token": {
                        $type: "color",
                        $value: "#00FF00",
                        $description: "Token level metadata",
                        $extensions: { custom: "value" },
                        $path: "color.withMetadata.token",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "color.withMetadata.token",
                    },
                },
                pathIndex: new Map([
                    ["color.withMetadata.token", "default.color.withMetadata.token"],
                ]),
            };
            const errors = validate(tokens);
            expect(errors).toHaveLength(0);
        });
    });

    describe("reference tokens without $type", () => {
        it("should skip validation for reference tokens", () => {
            const tokens: FlattenedTokens = {
                tokens: {
                    "default.color.primary": {
                        $type: "color",
                        $value: "#ff0000",
                        $path: "color.primary",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "color.primary",
                    },
                    "default.button.bg": {
                        $value: "{color.primary}", // No $type!
                        $path: "button.bg",
                        $source: { sourcePath: "test.json" },
                        $originalPath: "button.bg",
                    },
                },
                pathIndex: new Map([
                    ["color.primary", "default.color.primary"],
                    ["button.bg", "default.button.bg"],
                ]),
            };

            const errors = validate(tokens);
            expect(errors).toHaveLength(0);
        });
    });
});
