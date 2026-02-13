import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config/validate-config";
import { ErrorMessages } from "../src/constants/error-messages";
import { loadAndResolveTokens } from "../src/pipelines/load-and-resolve";
import { ValidationHelper } from "./__fixtures__/helpers/validation-helper";

const testConfig = validateConfig({});

describe("validation pipeline", () => {
    describe("success cases", () => {
        it("should successfully process valid tokens from resolver", async () => {
            const result = await loadAndResolveTokens({
                type: "resolver",
                resolverPath: "tests/__fixtures__/tokens/basic.resolver.json",
                config: testConfig,
            });

            expect(result.errors.load).toHaveLength(0);
            expect(result.errors.flatten).toHaveLength(0);
            ValidationHelper.expectNoErrors(result.errors.validation);
            expect(result.errors.resolution).toHaveLength(0);

            expect(result.trees.length).toBeGreaterThan(0);
            expect(result.resolved).toBeDefined();
        });
    });

    describe("error cases", () => {
        describe("load errors", () => {
            it("should handle invalid JSON files", async () => {
                const result = await loadAndResolveTokens({
                    type: "resolver",
                    resolverPath: "tests/__fixtures__/resolver/invalid-source.resolver.json",
                    config: testConfig,
                });

                expect(result.errors.load.length).toBeGreaterThan(0);
            });
        });

        describe("flatten errors", () => {
            it("should handle invalid token structure", async () => {
                const result = await loadAndResolveTokens({
                    type: "resolver",
                    resolverPath: "tests/__fixtures__/resolver/invalid-structure.resolver.json",
                    config: testConfig,
                });

                expect(result.errors.flatten).toHaveLength(1);
                expect(result.errors.flatten[0]?.message).toBe(
                    ErrorMessages.FLATTEN.MISSING_DOLLAR_PREFIX(
                        result.errors.flatten[0]?.path ?? ""
                    )
                );
            });
        });

        describe("validation errors", () => {
            it("should identify invalid token values", async () => {
                const result = await loadAndResolveTokens({
                    type: "resolver",
                    resolverPath: "tests/__fixtures__/resolver/invalid-token.resolver.json",
                    config: testConfig,
                });

                ValidationHelper.expectInvalidFontFamilyError(
                    result.errors.validation,
                    123,
                    "font.invalid.type.number"
                );

                expect(result.trees.length).toBeGreaterThan(0);
            });
        });

        describe("resolution errors", () => {
            it("should handle circular references", async () => {
                const result = await loadAndResolveTokens({
                    type: "resolver",
                    resolverPath: "tests/__fixtures__/tokens/circular.resolver.json",
                    config: testConfig,
                });

                expect(result.errors.resolution).toHaveLength(2);
                expect(result.errors.resolution[0]?.message).toContain("Circular reference");

                expect(result.trees.length).toBeGreaterThan(0);
            });
        });
    });
});
