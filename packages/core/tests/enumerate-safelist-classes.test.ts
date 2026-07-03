import { describe, expect, it } from "vitest";
import {
    clearMatchCache,
    convertConfigToUnoRules,
    enumerateSafelistClasses,
} from "../src/shared/uno-rules.js";
import type { UtilityClassesConfig } from "../src/types/config.js";
import type { NormalizedRenderableTokens } from "../src/types/render.js";
import { createRenderableToken } from "./__fixtures__/renderable-tokens.js";

const buildTokens = (
    tokens: Record<string, ReturnType<typeof createRenderableToken>>
): NormalizedRenderableTokens => ({ default: tokens });

const sorted = (classes: string[]) => [...classes].sort();

const resolves = (
    rules: ReturnType<typeof convertConfigToUnoRules>,
    className: string
): boolean => {
    for (const [pattern, handler] of rules) {
        const match = className.match(pattern);
        if (!match) continue;
        const css = handler(match);
        if (css && Object.keys(css).length > 0) return true;
    }
    return false;
};

describe("enumerateSafelistClasses", () => {
    it("returns nothing when no config opts into safelist", () => {
        const tokens = buildTokens({
            "color-primary": createRenderableToken({ $path: "color.primary" }),
        });

        expect(
            enumerateSafelistClasses({ color: { source: "color.*", prefix: "text" } }, tokens)
        ).toEqual([]);

        expect(
            enumerateSafelistClasses(
                { color: { source: "color.*", prefix: "text", safelist: false } },
                tokens
            )
        ).toEqual([]);
    });

    it("safelist: true emits the whole family under source", () => {
        const tokens = buildTokens({
            "color-primary": createRenderableToken({ $path: "color.primary" }),
            "color-secondary": createRenderableToken({
                $path: "color.secondary",
                $value: "#64748b",
            }),

            "space-sm": createRenderableToken({
                $type: "dimension",
                $path: "space.sm",
                $value: "8px",
            }),
        });

        const result = enumerateSafelistClasses(
            { "background-color": { source: "color.*", prefix: "bg", safelist: true } },
            tokens
        );

        expect(sorted(result)).toEqual(["bg-primary", "bg-secondary"]);
    });

    it("safelist: string[] emits only the listed slot values", () => {
        const tokens = buildTokens({
            "color-primary": createRenderableToken({ $path: "color.primary" }),
            "color-danger": createRenderableToken({ $path: "color.danger", $value: "#dc2626" }),
            "color-success": createRenderableToken({ $path: "color.success", $value: "#16a34a" }),
        });

        const result = enumerateSafelistClasses(
            {
                "background-color": {
                    source: "color.*",
                    prefix: "bg",
                    safelist: ["primary", "danger"],
                },
            },
            tokens
        );

        expect(sorted(result)).toEqual(["bg-danger", "bg-primary"]);
    });

    it("expands directional 'all' to the base class plus every direction variant", () => {
        const tokens = buildTokens({
            "space-sm": createRenderableToken({
                $type: "dimension",
                $path: "space.sm",
                $value: "8px",
            }),
        });

        const result = enumerateSafelistClasses(
            {
                padding: {
                    source: "space.*",
                    prefix: "p",
                    directions: ["all"],
                    safelist: true,
                },
            },
            tokens
        );

        expect(sorted(result)).toEqual(
            sorted(["p-sm", "pt-sm", "pr-sm", "pb-sm", "pl-sm", "px-sm", "py-sm"])
        );
    });

    it("respects stripDuplicates when enumerating class names", () => {
        const tokens = buildTokens({
            "color-text-muted": createRenderableToken({
                $path: "color.text.muted",
                $value: "#64748b",
            }),
        });

        const result = enumerateSafelistClasses(
            {
                color: {
                    source: "color.*",
                    prefix: "text",
                    stripDuplicates: true,
                    safelist: true,
                },
            },
            tokens
        );

        expect(result).toEqual(["text-muted"]);
    });
});

describe("enumerateSafelistClasses round-trips through the rules", () => {
    // The enumerator is a hand-written inverse of convertConfigToUnoRules. This
    // guards against the two drifting apart: every class it force-generates must
    // be one the actual rules can resolve, or UnoCSS would emit a dead entry.
    const cases: Array<{ name: string; config: UtilityClassesConfig }> = [
        {
            name: "simple prefixed",
            config: { color: { source: "color.*", prefix: "bg", safelist: true } },
        },
        {
            name: "string[] subset",
            config: {
                "background-color": {
                    source: "color.*",
                    prefix: "bg",
                    safelist: ["primary", "danger"],
                },
            },
        },
        {
            name: "directional all",
            config: {
                padding: { source: "space.*", prefix: "p", directions: ["all"], safelist: true },
            },
        },
        {
            name: "directional subset",
            config: {
                margin: {
                    source: "space.*",
                    prefix: "m",
                    directions: ["x", "y"],
                    safelist: true,
                },
            },
        },
        {
            name: "stripDuplicates",
            config: {
                color: {
                    source: "color.*",
                    prefix: "text",
                    stripDuplicates: true,
                    safelist: true,
                },
            },
        },
    ];

    const tokens = buildTokens({
        "color-primary": createRenderableToken({ $path: "color.primary" }),
        "color-danger": createRenderableToken({ $path: "color.danger", $value: "#dc2626" }),
        "color-text-muted": createRenderableToken({
            $path: "color.text.muted",
            $value: "#64748b",
        }),
        "space-sm": createRenderableToken({
            $type: "dimension",
            $path: "space.sm",
            $value: "8px",
        }),
    });

    it.each(cases)("$name: every emitted class resolves to CSS", ({ config }) => {
        clearMatchCache();
        const rules = convertConfigToUnoRules(config, tokens);
        const safelist = enumerateSafelistClasses(config, tokens);

        expect(safelist.length).toBeGreaterThan(0);
        for (const className of safelist) {
            expect(resolves(rules, className), `${className} should resolve`).toBe(true);
        }
    });
});
