import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/constants/error-messages.js";
import {
    isResolverFormat,
    parseResolverDocument,
    parseResolverDocumentFromString,
} from "../src/resolver/parse-resolver.js";

const fixturesPath = resolve(__dirname, "__fixtures__/resolver");

const parseInline = (doc: object) => parseResolverDocumentFromString(JSON.stringify(doc));

const hasError = (errors: Array<{ message: string }>, expected: string): boolean =>
    errors.some((e) => e.message === expected);

describe("parseResolverDocument", () => {
    describe("valid documents", () => {
        it("parses simple resolver document", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "simple.resolver.json")
            );

            expect(result.document.version).toBe("2025.10");
            expect(result.document.name).toBe("Simple Test");
            expect(result.document.resolutionOrder).toHaveLength(2);

            const realErrors = result.errors.filter(
                (e) => e.message !== ErrorMessages.RESOLVER.MODIFIER_SINGLE_CONTEXT
            );
            expect(realErrors).toHaveLength(0);
        });

        it("parses resolver with root-level sets and modifiers", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "with-refs.resolver.json")
            );

            expect(result.document.version).toBe("2025.10");
            expect(result.document.sets?.foundation).toBeDefined();
            expect(result.document.modifiers?.theme).toBeDefined();
            expect(result.document.resolutionOrder).toHaveLength(2);
        });

        it("parses complex resolver with multiple sets and contexts", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "complex.resolver.json")
            );

            expect(result.document.version).toBe("2025.10");
            expect(result.document.name).toBe("Complex Design System");
            expect(result.document.resolutionOrder).toHaveLength(4);
            expect(result.document.$extensions).toBeDefined();

            const themeModifier = result.document.resolutionOrder[3];
            expect(themeModifier).toMatchObject({
                type: "modifier",
                name: "theme",
                default: "light",
            });

            if (themeModifier && "contexts" in themeModifier) {
                expect(Object.keys(themeModifier.contexts as object)).toEqual([
                    "light",
                    "dark",
                    "ocean",
                    "ocean-dark",
                ]);
            }
        });

        it("preserves optional metadata fields", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "simple.resolver.json")
            );

            expect(result.document.name).toBe("Simple Test");
            expect(result.document.description).toBe("A simple resolver for testing");
        });
    });

    describe("invalid documents", () => {
        it("errors on invalid version", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "invalid-version.resolver.json")
            );

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toContain("2025.10");
        });

        it("errors on missing file", async () => {
            const filePath = resolve(fixturesPath, "nonexistent.resolver.json");
            const result = await parseResolverDocument(filePath);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toBe(ErrorMessages.RESOLVER.FILE_NOT_FOUND(filePath));
        });

        it("errors on invalid JSON", () => {
            const result = parseResolverDocumentFromString("{ invalid json }");

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.message).toMatch(/^Invalid JSON in resolver file:/);
        });

        it("errors on reference to undefined set", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "invalid-reference.resolver.json")
            );

            expect(
                hasError(result.errors, ErrorMessages.RESOLVER.UNDEFINED_SET("nonexistent"))
            ).toBe(true);
        });

        it("errors when source references a modifier (spec 4.2.1)", () => {
            const result = parseInline({
                version: "2025.10",
                modifiers: {
                    theme: { contexts: { light: [], dark: [] } },
                },
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "#/modifiers/theme" }] },
                ],
            });

            expect(
                hasError(
                    result.errors,
                    ErrorMessages.RESOLVER.INVALID_SOURCE_REFERENCE("#/modifiers/theme")
                )
            ).toBe(true);
        });

        it("errors when modifier context references another modifier (spec 4.1.5)", () => {
            const result = parseInline({
                version: "2025.10",
                modifiers: {
                    theme: { contexts: { light: [], dark: [] } },
                    size: {
                        contexts: {
                            small: [{ $ref: "#/modifiers/theme" }],
                            large: [],
                        },
                    },
                },
                resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/size" }],
            });

            expect(
                hasError(
                    result.errors,
                    ErrorMessages.RESOLVER.INVALID_SOURCE_REFERENCE("#/modifiers/theme")
                )
            ).toBe(true);
        });
    });

    describe("modifier validation", () => {
        it("warns when modifier has only 1 context", async () => {
            const result = await parseResolverDocument(
                resolve(fixturesPath, "single-context-modifier.resolver.json")
            );

            expect(hasError(result.errors, ErrorMessages.RESOLVER.MODIFIER_SINGLE_CONTEXT)).toBe(
                true
            );
        });

        it("errors when default context does not exist", () => {
            const result = parseInline({
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "modifier",
                        name: "theme",
                        default: "nonexistent",
                        contexts: { light: [], dark: [] },
                    },
                ],
            });

            expect(
                hasError(
                    result.errors,
                    ErrorMessages.RESOLVER.INVALID_DEFAULT("nonexistent", ["light", "dark"])
                )
            ).toBe(true);
        });
    });

    describe("name validation", () => {
        const invalidNames = [
            { name: "$invalid", reason: "starts with $", expectedErrors: 1 },
            { name: "invalid.name", reason: "contains dot", expectedErrors: 1 },
            { name: "invalid{name}", reason: "contains braces", expectedErrors: 2 },
        ];

        it.each(invalidNames)(
            "errors on name that $reason: '$name'",
            ({ name, expectedErrors }) => {
                const result = parseInline({
                    version: "2025.10",
                    resolutionOrder: [{ type: "set", name, sources: [] }],
                });

                expect(result.errors).toHaveLength(expectedErrors);
                expect(result.errors[0]?.message).toContain("Names must not");
            }
        );

        it("errors on duplicate names in resolutionOrder", () => {
            const result = parseInline({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "duplicate", sources: [] },
                    { type: "set", name: "duplicate", sources: [] },
                ],
            });

            expect(
                hasError(result.errors, ErrorMessages.RESOLVER.DUPLICATE_NAME("duplicate"))
            ).toBe(true);
        });
    });
});

describe("parseResolverDocumentFromString", () => {
    it("parses valid JSON string", () => {
        const result = parseResolverDocumentFromString(
            JSON.stringify({
                version: "2025.10",
                resolutionOrder: [{ type: "set", name: "test", sources: [] }],
            })
        );

        expect(result.document.version).toBe("2025.10");
        expect(result.document.resolutionOrder).toHaveLength(1);
    });

    it("errors on invalid JSON", () => {
        const result = parseResolverDocumentFromString("not json");

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toMatch(/^Invalid JSON in resolver file:/);
    });
});

describe("isResolverFormat", () => {
    const validCases = [
        {
            input: { version: "2025.10", resolutionOrder: [] },
            expected: true,
            desc: "valid resolver format",
        },
    ];

    const invalidCases = [
        { input: { resolutionOrder: [] }, expected: false, desc: "missing version" },
        {
            input: { version: "1.0.0", resolutionOrder: [] },
            expected: false,
            desc: "wrong version",
        },
        { input: { version: "2025.10" }, expected: false, desc: "missing resolutionOrder" },
        {
            input: { version: "2025.10", resolutionOrder: {} },
            expected: false,
            desc: "non-array resolutionOrder",
        },
        { input: null, expected: false, desc: "null" },
        { input: "string", expected: false, desc: "string" },
        { input: 123, expected: false, desc: "number" },
    ];

    it.each(validCases)("returns $expected for $desc", ({ input, expected }) => {
        expect(isResolverFormat(input)).toBe(expected);
    });

    it.each(invalidCases)("returns false for $desc", ({ input }) => {
        expect(isResolverFormat(input)).toBe(false);
    });
});
