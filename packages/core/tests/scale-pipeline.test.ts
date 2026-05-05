import { describe, expect, it } from "vitest";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { ResolvedToken } from "../src/types/resolve.js";
import type { TokenGroup, TokenTree } from "../src/types/tokens.js";

function scaleAuthoringGroup(scale: unknown): TokenGroup {
    return { $extensions: { "sh.sugarcube": { scale } } } as TokenGroup;
}

const buildTree = (
    tokens: TokenTree["tokens"],
    options: { sourcePath?: string; context?: string } = {}
): TokenTree => ({
    sourcePath: options.sourcePath ?? "test.json",
    ...(options.context && { context: options.context }),
    tokens,
});

const exponentialScale = {
    mode: "exponential",
    base: {
        min: { value: 1, unit: "rem" },
        max: { value: 1.125, unit: "rem" },
    },
    ratio: { min: 1.2, max: 1.25 },
    steps: { negative: 1, positive: 2 },
} as const;

const multipliersScale = {
    mode: "multipliers",
    base: {
        min: { value: 0.875, unit: "rem" },
        max: { value: 1, unit: "rem" },
    },
    multipliers: { sm: 1, md: 1.5 },
} as const;

describe("scale extension - pipeline integration", () => {
    it("materializes virtual tokens for an exponential scale", () => {
        const trees = [
            buildTree({
                size: {
                    step: scaleAuthoringGroup(exponentialScale),
                },
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.errors.flatten).toHaveLength(0);
        expect(result.errors.validation).toHaveLength(0);

        const expectedNames = ["size.step.-1", "size.step.0", "size.step.1", "size.step.2"];
        for (const name of expectedNames) {
            expect(result.resolved[name]).toBeDefined();
            const token = result.resolved[name] as ResolvedToken;
            expect(token.$type).toBe("dimension");
        }
    });

    it("materializes virtual tokens for a multiplier scale", () => {
        const trees = [
            buildTree({
                space: scaleAuthoringGroup(multipliersScale),
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.resolved["space.sm"]).toBeDefined();
        expect(result.resolved["space.md"]).toBeDefined();
    });

    it('emits adjacent pair tokens when pairs is "adjacent"', () => {
        const trees = [
            buildTree({
                space: scaleAuthoringGroup({ ...multipliersScale, pairs: "adjacent" }),
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.resolved["space.sm-md"]).toBeDefined();
    });

    it("lets a hand-authored token shadow a generated one with the same name", () => {
        const trees = [
            buildTree({
                space: {
                    ...scaleAuthoringGroup(multipliersScale),
                    md: {
                        $type: "dimension",
                        $value: { value: 10, unit: "rem" },
                        $extensions: {
                            "sh.sugarcube": {
                                fluid: {
                                    min: { value: 5, unit: "rem" },
                                    max: { value: 10, unit: "rem" },
                                },
                            },
                        },
                    },
                } as TokenGroup,
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        const md = result.resolved["space.md"] as ResolvedToken;
        expect(md.$value).toEqual({ value: 10, unit: "rem" });
        // The hand-authored fluid range survived — not the recipe-generated one
        // (which would have been 1.3125rem → 1.5rem from base × 1.5).
        const fluid = (md.$extensions as { "sh.sugarcube": { fluid: unknown } })["sh.sugarcube"]
            .fluid as { min: unknown; max: unknown };
        expect(fluid).toEqual({
            min: { value: 5, unit: "rem" },
            max: { value: 10, unit: "rem" },
        });
        // Sibling generated tokens are unaffected.
        expect(result.resolved["space.sm"]).toBeDefined();
    });

    it("emits exactly the listed pair tokens when pairs is an explicit list", () => {
        const trees = [
            buildTree({
                space: scaleAuthoringGroup({
                    ...multipliersScale,
                    multipliers: { sm: 1, md: 1.5, lg: 2 },
                    pairs: ["sm-lg"],
                }),
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.resolved["space.sm-lg"]).toBeDefined();
        expect(result.resolved["space.sm-md"]).toBeUndefined();
        expect(result.resolved["space.md-lg"]).toBeUndefined();
    });

    it("resolves references from another tree to a scale-generated token", () => {
        const trees = [
            buildTree(
                {
                    size: {
                        step: scaleAuthoringGroup(exponentialScale),
                    },
                },
                { sourcePath: "size.json" }
            ),
            buildTree(
                {
                    text: {
                        body: {
                            $type: "dimension",
                            $value: "{size.step.0}",
                        },
                    },
                },
                { sourcePath: "typography.json" }
            ),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.resolution).toHaveLength(0);
        const body = result.resolved["text.body"] as ResolvedToken;
        expect(body.$resolvedValue).toEqual({ value: 1.125, unit: "rem" });
    });

    it("preserves sibling tokens authored alongside a scale group", () => {
        const trees = [
            buildTree({
                size: {
                    step: scaleAuthoringGroup(exponentialScale),
                    "h1-custom": {
                        $type: "dimension",
                        $value: { value: 3, unit: "rem" },
                    },
                },
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.resolved["size.h1-custom"]).toBeDefined();
        expect(result.resolved["size.step.0"]).toBeDefined();
    });

    it("does not overwrite an authored child that collides with a generated step name", () => {
        const trees = [
            buildTree({
                size: {
                    step: {
                        ...scaleAuthoringGroup(exponentialScale),
                        "0": {
                            $type: "dimension",
                            $value: { value: 99, unit: "rem" },
                        },
                    } as TokenGroup,
                },
            }),
        ];

        const result = resolveTokens(trees);

        const token = result.resolved["size.step.0"] as ResolvedToken;
        expect(token.$resolvedValue).toEqual({ value: 99, unit: "rem" });
    });
});

describe("scale extension - validation errors", () => {
    it("surfaces a scale validation error via expandTree errors", () => {
        const trees = [
            buildTree({
                size: {
                    step: scaleAuthoringGroup({
                        mode: "exponential",
                        base: {
                            min: { value: 1, unit: "rem" },
                            max: { value: 1.125, unit: "rem" },
                        },
                        ratio: { min: 1, max: 1 }, // both <= 1
                        steps: { negative: 1, positive: 2 },
                    }),
                },
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree.length).toBeGreaterThan(0);
        const ratioErrors = result.errors.expandTree.filter((e) => e.path.endsWith(".ratio.min"));
        expect(ratioErrors).toHaveLength(1);
    });

    it("does not materialize tokens when the recipe is invalid", () => {
        const trees = [
            buildTree({
                size: {
                    step: scaleAuthoringGroup({
                        mode: "exponential", // missing base, ratio, steps
                    }),
                },
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree.length).toBeGreaterThan(0);
        expect(result.resolved["size.step.0"]).toBeUndefined();
    });
});

describe("scale extension - regression: existing pipeline behavior", () => {
    it("leaves trees without scale extensions untouched", () => {
        const trees = [
            buildTree({
                color: {
                    $type: "color",
                    primary: { $value: "#0066cc" },
                },
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.resolved["color.primary"]).toBeDefined();
    });

    it("still resolves $ref to authored tokens alongside scale expansion in the same tree", () => {
        // $ref is JSON Pointer and resolves before scale materializes — it
        // can only target authored tokens. Curly-brace references can target
        // scale-generated tokens (covered by the cross-tree test above).
        const trees = [
            buildTree({
                color: {
                    $type: "color",
                    blue: { $value: "#0066cc" },
                },
                button: {
                    background: { $ref: "#/color/blue" },
                },
                size: {
                    step: scaleAuthoringGroup(exponentialScale),
                },
            }),
        ];

        const result = resolveTokens(trees);

        expect(result.errors.expandTree).toHaveLength(0);
        expect(result.resolved["button.background"]).toBeDefined();
        expect(result.resolved["size.step.0"]).toBeDefined();
    });
});
