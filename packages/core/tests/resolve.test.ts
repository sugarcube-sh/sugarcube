import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/shared/constants/error-messages.js";
import { dereference } from "../src/shared/pipeline/dereference.js";
import type { FlattenedTokens } from "../src/types/flatten.js";
import type { ResolvedToken } from "../src/types/resolve.js";
import { createFlattenedToken, flattenedTokens } from "./__fixtures__/flattened-tokens.js";

describe("resolve", () => {
    describe("basic resolution", () => {
        it("should resolve simple references", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.primary": createFlattenedToken({
                        $source: { sourcePath: "tokens.json" },
                    }),
                    "color.text": flattenedTokens.colorText,
                },
                pathIndex: new Map([["color.primary", "color.primary"]]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(0);
            expect((result.resolved["color.text"] as ResolvedToken).$resolvedValue).toBe("#FF0000");
        });

        it("should resolve nested object references", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.primary": createFlattenedToken({
                        $source: { sourcePath: "tokens.json" },
                    }),
                    "shadow.small": flattenedTokens.shadowSmall,
                },
                pathIndex: new Map([["color.primary", "color.primary"]]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(0);
            expect((result.resolved["shadow.small"] as ResolvedToken).$resolvedValue).toEqual({
                color: "#FF0000",
                offsetX: "0px",
                offsetY: "1px",
                blur: "2px",
                spread: "0px",
            });
        });

        it("should resolve array references", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.primary": createFlattenedToken({
                        $source: { sourcePath: "tokens.json" },
                    }),
                    "gradient.primary": flattenedTokens.gradientPrimary,
                },
                pathIndex: new Map([["color.primary", "color.primary"]]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(0);
            expect((result.resolved["gradient.primary"] as ResolvedToken).$resolvedValue).toEqual([
                {
                    color: "#FF0000",
                    position: "0%",
                },
                {
                    color: "#000000",
                    position: "100%",
                },
            ]);
        });
    });

    describe("error cases", () => {
        it("should detect circular references", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.primary": createFlattenedToken({
                        $value: "{color.text}",
                        $source: { sourcePath: "tokens.json" },
                    }),
                    "color.text": createFlattenedToken({
                        $value: "{color.primary}",
                        $path: "color.text",
                        $originalPath: "color.text",
                        $source: { sourcePath: "tokens.json" },
                    }),
                },
                pathIndex: new Map([
                    ["color.primary", "color.primary"],
                    ["color.text", "color.text"],
                ]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(2);
            expect(result.errors[0]).toEqual({
                type: "circular",
                path: "color.primary",
                source: { sourcePath: "tokens.json" },
                message: ErrorMessages.RESOLVE.CIRCULAR_REFERENCE("color.primary", "color.text"),
            });
        });

        it("should detect missing references", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.text": createFlattenedToken({
                        $value: "{color.primary}",
                        $path: "color.text",
                        $originalPath: "color.text",
                        $source: { sourcePath: "tokens.json" },
                    }),
                },
                pathIndex: new Map(),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual({
                type: "missing",
                path: "color.text",
                source: { sourcePath: "tokens.json" },
                message: ErrorMessages.RESOLVE.REFERENCE_NOT_FOUND("color.primary", "color.text"),
            });
        });

        // This is currently impossible to test for in our system

        // it("should detect type mismatches", () => {
        //     const input: FlattenedTokens = {
        //         tokens: {
        //             "spacing.small": {
        //                 $type: "dimension",
        //                 $value: { value: 4, unit: "px" },
        //                 $path: "spacing.small",
        //                 $source: { sourcePath: "tokens.json" },
        //                 $originalPath: "spacing.small",
        //             },
        //             "color.text": {
        //                 $type: "color",
        //                 $value: "{spacing.small}",
        //                 $path: "color.text",
        //                 $source: { sourcePath: "tokens.json" },
        //                 $originalPath: "color.text",
        //             },
        //         },
        //         pathIndex: new Map([["spacing.small", "spacing.small"]]),
        //     };

        //     const result = dereference(input);

        //     expect(result.errors).toHaveLength(1);
        //     expect(result.errors[0]).toEqual({
        //         type: "type-mismatch",
        //         path: "color.text",
        //         source: { sourcePath: "tokens.json" },
        //         message: ErrorMessages.RESOLVE.TYPE_MISMATCH("color.text"),
        //     });
        // });

        it("should detect nested property references", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.primary": createFlattenedToken({
                        $source: { sourcePath: "tokens.json" },
                    }),
                    "shadow.small": flattenedTokens.shadowSmall,
                    "shadow.medium": createFlattenedToken({
                        $type: "shadow" as const,
                        $value: {
                            color: "{shadow.small.color}",
                            offsetX: "0px",
                            offsetY: "2px",
                            blur: "4px",
                            spread: "0px",
                        },
                        $path: "shadow.medium",
                        $originalPath: "shadow.medium",
                        $source: { sourcePath: "tokens.json" },
                    }),
                },
                pathIndex: new Map([
                    ["color.primary", "color.primary"],
                    ["shadow.small", "shadow.small"],
                ]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual({
                type: "missing",
                path: "shadow.medium",
                source: { sourcePath: "tokens.json" },
                message: ErrorMessages.RESOLVE.REFERENCE_NOT_FOUND(
                    "shadow.small.color",
                    "shadow.medium.color",
                ),
            });
        });
    });

    describe("edge cases", () => {
        it("should handle references to metadata nodes", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color": {
                        $type: "color",
                        $description: "Color tokens",
                        $path: "color",
                        $source: { sourcePath: "tokens.json" },
                        $originalPath: "color",
                    },
                    "color.text": createFlattenedToken({
                        $value: "{color}",
                        $path: "color.text",
                        $originalPath: "color.text",
                        $source: { sourcePath: "tokens.json" },
                    }),
                },
                pathIndex: new Map([["color", "color"]]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual({
                type: "missing",
                path: "color.text",
                source: { sourcePath: "tokens.json" },
                message: ErrorMessages.RESOLVE.REFERENCE_NOT_FOUND("color", "color.text"),
            });
        });

        it("should handle nested references in arrays", () => {
            const input: FlattenedTokens = {
                tokens: {
                    "color.primary": createFlattenedToken({
                        $source: { sourcePath: "tokens.json" },
                    }),
                    "shadow.small": flattenedTokens.shadowSmall,
                    "shadow.medium": createFlattenedToken({
                        $type: "shadow" as const,
                        $value: {
                            color: "{color.primary}",
                            offsetX: "0px",
                            offsetY: "2px",
                            blur: "4px",
                            spread: "0px",
                        },
                        $path: "shadow.medium",
                        $originalPath: "shadow.medium",
                        $source: { sourcePath: "tokens.json" },
                    }),
                },
                pathIndex: new Map([
                    ["color.primary", "color.primary"],
                    ["shadow.small", "shadow.small"],
                ]),
            };

            const result = dereference(input);

            expect(result.errors).toHaveLength(0);
            expect((result.resolved["shadow.medium"] as ResolvedToken).$resolvedValue).toEqual({
                color: "#FF0000",
                offsetX: "0px",
                offsetY: "2px",
                blur: "4px",
                spread: "0px",
            });
        });
    });

    describe("permutation context", () => {
        const input: FlattenedTokens = {
            tokens: {
                "perm:0.color.neutral.50": createFlattenedToken({
                    $value: "#fafafa",
                    $path: "color.neutral.50",
                    $originalPath: "color.neutral.50",
                }),
                "perm:0.color.neutral.950": createFlattenedToken({
                    $value: "#0a0a0a",
                    $path: "color.neutral.950",
                    $originalPath: "color.neutral.950",
                }),
                "perm:0.color.neutral.text.link": createFlattenedToken({
                    $value: "{color.neutral.950}",
                    $path: "color.neutral.text.link",
                    $originalPath: "color.neutral.text.link",
                }),
                "perm:0.color.text.link": createFlattenedToken({
                    $value: "{color.neutral.text.link}",
                    $path: "color.text.link",
                    $originalPath: "color.text.link",
                }),
                "perm:1.color.neutral.50": createFlattenedToken({
                    $value: "#fafafa",
                    $path: "color.neutral.50",
                    $originalPath: "color.neutral.50",
                }),
                "perm:1.color.neutral.950": createFlattenedToken({
                    $value: "#0a0a0a",
                    $path: "color.neutral.950",
                    $originalPath: "color.neutral.950",
                }),
                "perm:1.color.neutral.text.link": createFlattenedToken({
                    $value: "{color.neutral.50}",
                    $path: "color.neutral.text.link",
                    $originalPath: "color.neutral.text.link",
                }),
                "perm:1.color.text.link": createFlattenedToken({
                    $value: "{color.neutral.text.link}",
                    $path: "color.text.link",
                    $originalPath: "color.text.link",
                }),
            },
            pathIndex: new Map([
                ["color.neutral.50", "perm:1.color.neutral.50"],
                ["color.neutral.950", "perm:1.color.neutral.950"],
                ["color.neutral.text.link", "perm:1.color.neutral.text.link"],
                ["color.text.link", "perm:1.color.text.link"],
            ]),
        };

        it("resolves the intermediate token directly to its per-permutation value", () => {
            const { resolved } = dereference(input);

            expect(
                (resolved["perm:0.color.neutral.text.link"] as ResolvedToken).$resolvedValue,
            ).toBe("#0a0a0a");
            expect(
                (resolved["perm:1.color.neutral.text.link"] as ResolvedToken).$resolvedValue,
            ).toBe("#fafafa");
        });

        it("resolves a chained reference to the perm-correct value", () => {
            const { resolved } = dereference(input);

            expect((resolved["perm:1.color.text.link"] as ResolvedToken).$resolvedValue).toBe(
                "#fafafa",
            );
            expect((resolved["perm:0.color.text.link"] as ResolvedToken).$resolvedValue).toBe(
                "#0a0a0a",
            );
        });
    });
});
