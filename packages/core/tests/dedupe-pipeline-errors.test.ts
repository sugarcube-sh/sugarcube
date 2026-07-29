import { describe, expect, it } from "vitest";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { TokenTree } from "../src/types/tokens.js";

function brokenTree(context: string, missingRef: string): TokenTree {
    return {
        context: context || undefined,
        sourcePath: "tokens.json",
        tokens: {
            color: {
                $type: "color",
                surface: { default: { $value: `{${missingRef}}` } },
            },
        },
    } as TokenTree;
}

describe("resolveTokens collapses duplicated resolution errors across permutations", () => {
    it("reports a shared missing reference once, not once per permutation", () => {
        const { errors } = resolveTokens([
            brokenTree("perm:0", "color.orange"),
            brokenTree("perm:1", "color.orange"),
            brokenTree("perm:2", "color.orange"),
        ]);

        expect(errors.resolution).toHaveLength(1);
        expect(errors.resolution[0]?.message).toContain("color.orange");
    });

    it("keeps the clean (non-namespaced) message when a base copy exists", () => {
        const { errors } = resolveTokens([
            brokenTree("", "color.orange"), // base, unprefixed
            brokenTree("perm:0", "color.orange"),
        ]);

        expect(errors.resolution).toHaveLength(1);
        expect(errors.resolution[0]?.message).not.toContain("perm:");
    });

    it("dedupes a circular reference reported in multiple permutations", () => {
        // Circular errors are non-missing, so they flow through
        // dedupeResolutionErrors rather than the missing-reference grouping.
        const loopTree = (context: string): TokenTree =>
            ({
                context,
                sourcePath: "tokens.json",
                tokens: { color: { $type: "color", loop: { $value: "{color.loop}" } } },
            }) as TokenTree;

        const { errors } = resolveTokens([loopTree("perm:0"), loopTree("perm:1")]);

        const circular = errors.resolution.filter((e) => e.type === "circular");
        expect(circular).toHaveLength(1);
    });
});
