import { describe, expect, it } from "vitest";
import type { NormalizedConvertedTokens } from "../src/types/convert.js";
import {
    convertConfigToUnoRules,
    findMatchingToken,
    getDirectionAbbreviation,
    getLogicalProperty,
} from "../src/utils/convert-utility-config-to-uno-rules.js";
import { createConvertedToken } from "./__fixtures__/converted-tokens.js";

const buildTokens = (
    tokens: Record<string, ReturnType<typeof createConvertedToken>>
): NormalizedConvertedTokens => ({ default: tokens });

const testRule = (
    rules: ReturnType<typeof convertConfigToUnoRules>,
    className: string,
    expectedCss: Record<string, string> | null
) => {
    const matchingRule = rules.find(([pattern]) => pattern.test(className));
    if (expectedCss === null) {
        expect(matchingRule).toBeUndefined();
        return;
    }
    expect(matchingRule).toBeDefined();
    if (!matchingRule) return;

    const [pattern, handler] = matchingRule;
    const match = className.match(pattern);
    expect(match).toBeTruthy();
    if (!match) return;

    expect(handler(match)).toEqual(expectedCss);
};

describe("convertConfigToUnoRules", () => {
    describe("basic utility generation", () => {
        const tokens = buildTokens({
            "color-primary": createConvertedToken({ $path: "color.primary" }),
            "color-secondary": createConvertedToken({
                $path: "color.secondary",
                $value: "#64748b",
            }),
        });

        it("generates rules matching prefix + token name", () => {
            const rules = convertConfigToUnoRules(
                { color: { source: "color.*", prefix: "text" } },
                tokens
            );

            expect(rules).toHaveLength(1);
            testRule(rules, "text-primary", { color: "var(--color-primary)" });
            testRule(rules, "text-secondary", { color: "var(--color-secondary)" });
            testRule(rules, "bg-primary", null);
        });

        it("uses source path base as prefix when no prefix specified", () => {
            const textTokens = buildTokens({
                "text-lg": createConvertedToken({
                    $type: "dimension",
                    $path: "text.lg",
                    $value: "18px",
                }),
            });

            const rules = convertConfigToUnoRules(
                { "font-size": { source: "text.*" } },
                textTokens
            );

            expect(rules).toHaveLength(1);
            testRule(rules, "text-lg", { "font-size": "var(--text-lg)" });
            testRule(rules, "font-lg", null);
        });
    });

    describe("directional utilities", () => {
        const tokens = buildTokens({
            "space-sm": createConvertedToken({
                $type: "dimension",
                $path: "space.sm",
                $value: "8px",
            }),
            "space-md": createConvertedToken({
                $type: "dimension",
                $path: "space.md",
                $value: "16px",
            }),
        });

        it("generates rules for each specified direction", () => {
            const rules = convertConfigToUnoRules(
                {
                    padding: {
                        source: "space.*",
                        prefix: "p",
                        directions: ["top", "right", "bottom", "left", "x", "y"],
                    },
                },
                tokens
            );

            expect(rules).toHaveLength(6);

            testRule(rules, "pt-sm", { "padding-block-start": "var(--space-sm)" });
            testRule(rules, "pr-md", { "padding-inline-end": "var(--space-md)" });
            testRule(rules, "pb-sm", { "padding-block-end": "var(--space-sm)" });
            testRule(rules, "pl-md", { "padding-inline-start": "var(--space-md)" });
            testRule(rules, "px-sm", { "padding-inline": "var(--space-sm)" });
            testRule(rules, "py-md", { "padding-block": "var(--space-md)" });
        });

        it("expands 'all' direction to simple + directional rules", () => {
            const rules = convertConfigToUnoRules(
                { padding: { source: "space.*", prefix: "p", directions: ["all"] } },
                tokens
            );

            // 'all' expands to: 1 simple rule + 6 directional rules = 7 total
            expect(rules).toHaveLength(7);

            testRule(rules, "p-sm", { padding: "var(--space-sm)" });

            testRule(rules, "pt-sm", { "padding-block-start": "var(--space-sm)" });
            testRule(rules, "px-md", { "padding-inline": "var(--space-md)" });
        });
    });

    describe("stripDuplicates option", () => {
        it("matches nested tokens by stripping duplicate prefix from path", () => {
            const tokens = buildTokens({
                "color-text-muted": createConvertedToken({
                    $path: "color.text.muted",
                    $value: "#64748b",
                }),
                "color-text-primary": createConvertedToken({
                    $path: "color.text.primary",
                    $value: "#000",
                }),
            });

            const rules = convertConfigToUnoRules(
                { color: { source: "color.*", prefix: "text", stripDuplicates: true } },
                tokens
            );

            expect(rules).toHaveLength(1);

            // "text-muted" should find color.text.muted
            testRule(rules, "text-muted", { color: "var(--color-text-muted)" });

            // "text-text-muted" should also work (strips duplicate)
            testRule(rules, "text-text-muted", { color: "var(--color-text-muted)" });
        });
    });

    describe("smart rules (multiple configs sharing prefix)", () => {
        it("generates single rule when multiple configs share same prefix and source", () => {
            const tokens = buildTokens({
                "color-primary": createConvertedToken({ $path: "color.primary" }),
            });

            const rules = convertConfigToUnoRules(
                {
                    color: { source: "color.*", prefix: "brand" },
                    "background-color": { source: "color.*", prefix: "brand" },
                    "border-color": { source: "color.*", prefix: "brand" },
                },
                tokens
            );

            expect(rules).toHaveLength(1);

            testRule(rules, "brand-primary", { color: "var(--color-primary)" });
            testRule(rules, "brand-nonexistent", {});
        });

        it("tries each config in order until finding a match", () => {
            const tokens = buildTokens({
                "color-primary": createConvertedToken({ $path: "color.primary" }),
                "color-secondary": createConvertedToken({
                    $path: "color.secondary",
                    $value: "#64748b",
                }),
            });

            const rules = convertConfigToUnoRules(
                {
                    color: { source: "color.*", prefix: "brand" },
                    "background-color": { source: "color.*", prefix: "brand" },
                },
                tokens
            );

            expect(rules).toHaveLength(1);

            testRule(rules, "brand-primary", { color: "var(--color-primary)" });
            testRule(rules, "brand-secondary", { color: "var(--color-secondary)" });
        });
    });
});

describe("findMatchingToken", () => {
    const tokens = buildTokens({
        "color-primary": createConvertedToken({ $path: "color.primary" }),
        "spacing-small": createConvertedToken({
            $type: "dimension",
            $path: "spacing.small",
            $value: "8px",
        }),
        "button-primary": createConvertedToken({ $path: "button.primary", $value: "#00f" }),
    });

    it("finds token by matching source pattern", () => {
        expect(findMatchingToken("primary", { source: "color.*", prefix: "text" }, tokens)).toEqual(
            ["color", "primary"]
        );

        expect(findMatchingToken("small", { source: "spacing.*", prefix: "p" }, tokens)).toEqual([
            "spacing",
            "small",
        ]);
    });

    it("returns null when no token matches", () => {
        expect(
            findMatchingToken("nonexistent", { source: "color.*", prefix: "text" }, tokens)
        ).toBeNull();
    });

    it("returns null when token type is incompatible with property", () => {
        expect(
            findMatchingToken(
                "sm",
                { source: "space.*", prefix: "text", property: "color" },
                tokens
            )
        ).toBeNull();
    });
});

describe("getDirectionAbbreviation", () => {
    const cases = [
        { direction: "top", expected: "t" },
        { direction: "right", expected: "r" },
        { direction: "bottom", expected: "b" },
        { direction: "left", expected: "l" },
        { direction: "x", expected: "x" },
        { direction: "y", expected: "y" },
        { direction: "full", expected: "" },
        { direction: "all", expected: "" },
    ] as const;

    it.each(cases)("returns '$expected' for '$direction'", ({ direction, expected }) => {
        expect(getDirectionAbbreviation(direction)).toBe(expected);
    });
});

describe("getLogicalProperty", () => {
    const cases = [
        { base: "padding", direction: "top", expected: "padding-block-start" },
        { base: "padding", direction: "right", expected: "padding-inline-end" },
        { base: "padding", direction: "bottom", expected: "padding-block-end" },
        { base: "padding", direction: "left", expected: "padding-inline-start" },
        { base: "padding", direction: "x", expected: "padding-inline" },
        { base: "padding", direction: "y", expected: "padding-block" },
        { base: "padding", direction: "full", expected: "padding" },
        { base: "padding", direction: "all", expected: "padding" },
        { base: "margin", direction: "top", expected: "margin-block-start" },
        { base: "margin", direction: "x", expected: "margin-inline" },
    ] as const;

    it.each(cases)(
        "returns '$expected' for base='$base', direction='$direction'",
        ({ base, direction, expected }) => {
            expect(getLogicalProperty(base, direction)).toBe(expected);
        }
    );
});
