import { describe, expect, it } from "vitest";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { TokenTree } from "../src/types/tokens.js";

function tree(tokens: Record<string, unknown>): TokenTree {
    return { context: "perm:0", sourcePath: "t.json", tokens } as TokenTree;
}

describe("reference resolution cleanup", () => {
    it("a missing reference behind other referrers does not cause a false circular error", () => {
        const { errors } = resolveTokens([
            tree({
                color: {
                    $type: "color",
                    broken: { $value: "{color.gone}" },
                    x: { $value: "{color.broken}" },
                    y: { $value: "{color.broken}" },
                },
            }),
        ]);

        expect(errors.resolution.filter((e) => e.type === "circular")).toHaveLength(0);
    });

    it("still detects a genuine circular reference", () => {
        const { errors } = resolveTokens([
            tree({
                color: {
                    $type: "color",
                    a: { $value: "{color.b}" },
                    b: { $value: "{color.a}" },
                },
            }),
        ]);

        expect(errors.resolution.some((e) => e.type === "circular")).toBe(true);
    });
});
