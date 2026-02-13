import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/constants/error-messages.js";
import {
    getAvailableContexts,
    getDefaultInputs,
    hasModifiers,
    validateInputs,
} from "../src/resolver/validate-inputs.js";
import type { ResolverDocument } from "../src/types/resolver.js";

const buildDoc = {
    withModifier: (name: string, contexts: string[], defaultValue?: string): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: [
            {
                type: "modifier",
                name,
                contexts: Object.fromEntries(contexts.map((c) => [c, []])),
                ...(defaultValue !== undefined && { default: defaultValue }),
            },
        ],
    }),

    withModifiers: (
        modifiers: Array<{ name: string; contexts: string[]; default?: string }>
    ): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: modifiers.map((m) => ({
            type: "modifier" as const,
            name: m.name,
            contexts: Object.fromEntries(m.contexts.map((c) => [c, []])),
            ...(m.default !== undefined && { default: m.default }),
        })),
    }),

    withSet: (name = "base"): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: [{ type: "set", name, sources: [] }],
    }),

    withRefModifier: (
        name: string,
        contexts: string[],
        defaultValue?: string
    ): ResolverDocument => ({
        version: "2025.10",
        modifiers: {
            [name]: {
                contexts: Object.fromEntries(contexts.map((c) => [c, []])),
                ...(defaultValue !== undefined && { default: defaultValue }),
            },
        },
        resolutionOrder: [{ $ref: `#/modifiers/${name}` }],
    }),
};

describe("validateInputs", () => {
    describe("valid inputs", () => {
        it("accepts matching modifier input", () => {
            const result = validateInputs(
                buildDoc.withModifier("theme", ["light", "dark"], "light"),
                { theme: "dark" }
            );
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.resolvedInputs).toEqual({ theme: "dark" });
        });

        it("uses default when no input provided", () => {
            const result = validateInputs(
                buildDoc.withModifier("theme", ["light", "dark"], "light"),
                {}
            );
            expect(result.valid).toBe(true);
            expect(result.resolvedInputs).toEqual({ theme: "light" });
        });

        it("handles multiple modifiers", () => {
            const result = validateInputs(
                buildDoc.withModifiers([
                    { name: "theme", contexts: ["light", "dark"], default: "light" },
                    {
                        name: "density",
                        contexts: ["comfortable", "compact"],
                        default: "comfortable",
                    },
                ]),
                { theme: "dark", density: "compact" }
            );
            expect(result.valid).toBe(true);
            expect(result.resolvedInputs).toEqual({ theme: "dark", density: "compact" });
        });

        it("passes when document has no modifiers and no inputs", () => {
            const result = validateInputs(buildDoc.withSet(), {});
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe("invalid inputs", () => {
        const invalidInputCases = [
            {
                name: "unknown modifier",
                doc: buildDoc.withModifier("theme", ["light", "dark"], "light"),
                inputs: { unknown: "value" },
                expectedError: ErrorMessages.RESOLVER.UNKNOWN_MODIFIER("unknown"),
                expectedModifier: "unknown",
            },
            {
                name: "invalid context value",
                doc: buildDoc.withModifier("theme", ["light", "dark"], "light"),
                inputs: { theme: "invalid" },
                expectedError: ErrorMessages.RESOLVER.INVALID_CONTEXT("invalid", "theme", [
                    "light",
                    "dark",
                ]),
            },
            {
                name: "missing required modifier (no default)",
                doc: buildDoc.withModifier("theme", ["light", "dark"]),
                inputs: {},
                expectedError: ErrorMessages.RESOLVER.MISSING_REQUIRED_INPUT("theme"),
                expectedModifier: "theme",
            },
            {
                name: "boolean input value",
                doc: buildDoc.withModifier("beta", ["enabled", "disabled"], "disabled"),
                inputs: { beta: true as unknown as string },
                expectedError: ErrorMessages.RESOLVER.INVALID_INPUT_TYPE("beta"),
            },
            {
                name: "numeric input value",
                doc: buildDoc.withModifier("size", ["small", "large"], "small"),
                inputs: { size: 100 as unknown as string },
                expectedError: ErrorMessages.RESOLVER.INVALID_INPUT_TYPE("size"),
            },
            {
                name: "inputs provided but no modifiers defined",
                doc: buildDoc.withSet(),
                inputs: { theme: "dark" },
                expectedError: ErrorMessages.RESOLVER.UNKNOWN_MODIFIER("theme"),
            },
        ];

        it.each(invalidInputCases)(
            "rejects $name",
            ({ doc, inputs, expectedError, expectedModifier }) => {
                const result = validateInputs(doc, inputs);
                expect(result.valid).toBe(false);
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0]?.message).toBe(expectedError);
                if (expectedModifier) {
                    expect(result.errors[0]?.modifier).toBe(expectedModifier);
                }
            }
        );

        it("collects multiple errors", () => {
            const result = validateInputs(
                buildDoc.withModifiers([
                    { name: "theme", contexts: ["light", "dark"] }, // no default
                    {
                        name: "density",
                        contexts: ["comfortable", "compact"],
                        default: "comfortable",
                    },
                ]),
                { density: "invalid", unknown: "value" }
            );
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("root-level modifier references", () => {
        it("handles modifiers referenced via $ref", () => {
            const result = validateInputs(
                buildDoc.withRefModifier("theme", ["light", "dark"], "light"),
                { theme: "dark" }
            );
            expect(result.valid).toBe(true);
            expect(result.resolvedInputs).toEqual({ theme: "dark" });
        });

        it("uses default from referenced modifier", () => {
            const result = validateInputs(
                buildDoc.withRefModifier("theme", ["light", "dark"], "light"),
                {}
            );
            expect(result.valid).toBe(true);
            expect(result.resolvedInputs).toEqual({ theme: "light" });
        });
    });
});

describe("getAvailableContexts", () => {
    it("returns all contexts for each modifier", () => {
        const contexts = getAvailableContexts(
            buildDoc.withModifiers([
                { name: "theme", contexts: ["light", "dark", "ocean"], default: "light" },
                { name: "density", contexts: ["comfortable", "compact"] },
            ])
        );
        expect(contexts.size).toBe(2);
        expect(contexts.get("theme")).toEqual({
            contexts: ["light", "dark", "ocean"],
            default: "light",
        });
        expect(contexts.get("density")).toEqual({
            contexts: ["comfortable", "compact"],
            default: undefined,
        });
    });

    it("returns empty map for document with no modifiers", () => {
        expect(getAvailableContexts(buildDoc.withSet()).size).toBe(0);
    });
});

describe("getDefaultInputs", () => {
    it("returns default inputs for all modifiers", () => {
        const defaults = getDefaultInputs(
            buildDoc.withModifiers([
                { name: "theme", contexts: ["light", "dark"], default: "light" },
                { name: "density", contexts: ["comfortable", "compact"], default: "comfortable" },
            ])
        );
        expect(defaults).toEqual({ theme: "light", density: "comfortable" });
    });

    it("throws if any modifier has no default", () => {
        expect(() => getDefaultInputs(buildDoc.withModifier("theme", ["light", "dark"]))).toThrow(
            ErrorMessages.RESOLVER.MISSING_REQUIRED_INPUT("theme")
        );
    });

    it("returns empty object for document with no modifiers", () => {
        expect(getDefaultInputs(buildDoc.withSet())).toEqual({});
    });
});

describe("hasModifiers", () => {
    it("returns true for inline modifiers", () => {
        expect(hasModifiers(buildDoc.withModifier("theme", ["light", "dark"]))).toBe(true);
    });

    it("returns true for referenced modifiers", () => {
        expect(hasModifiers(buildDoc.withRefModifier("theme", ["light", "dark"]))).toBe(true);
    });

    it("returns false when no modifiers", () => {
        expect(hasModifiers(buildDoc.withSet())).toBe(false);
    });

    it("returns false when modifiers exist but are not in resolutionOrder", () => {
        const doc: ResolverDocument = {
            version: "2025.10",
            modifiers: { unused: { contexts: { a: [], b: [] } } },
            resolutionOrder: [{ type: "set", name: "base", sources: [] }],
        };
        expect(hasModifiers(doc)).toBe(false);
    });
});
