import { describe, expect, it } from "vitest";
import { inlinePrivateReferences } from "../src/shared/pipeline/inline-private-references.js";
import type { ResolvedToken, ResolvedTokens } from "../src/types/resolve.js";
import type { TokenType } from "../src/types/tokens.js";

function token(
    overrides: Partial<ResolvedToken<TokenType>> & { $path: string }
): ResolvedToken<TokenType> {
    const path = overrides.$path;
    return {
        $type: "color",
        $value: "#000000",
        $resolvedValue: "#000000",
        $originalPath: path,
        $source: { sourcePath: "tokens.json" },
        ...overrides,
    } as ResolvedToken<TokenType>;
}

const ROSE = "oklch(0.586 0.253 17.585)";
const PRIMARY = "oklch(0.7 0.2 280)";

describe("inlinePrivateReferences (#89)", () => {
    it("inlines a reference straight into a private literal, and drops the private token", () => {
        const input: ResolvedTokens = {
            "rose.600": token({
                $value: ROSE,
                $resolvedValue: ROSE,
                $path: "rose.600",
                $source: { sourcePath: "raw.json", emit: false },
            }),
            "color.danger": token({
                $value: "{rose.600}",
                $resolvedValue: ROSE,
                $path: "color.danger",
                $source: { sourcePath: "semantic.json" },
            }),
        };

        const out = inlinePrivateReferences(input);

        expect(out["rose.600"]).toBeUndefined();
        expect((out["color.danger"] as ResolvedToken).$value).toBe(ROSE);
    });

    it("keeps a reference to a PUBLIC token, even when that token itself references a private one", () => {
        const input: ResolvedTokens = {
            "rose.600": token({
                $value: ROSE,
                $resolvedValue: ROSE,
                $path: "rose.600",
                $source: { sourcePath: "raw.json", emit: false },
            }),
            "color.brand": token({
                $value: "{rose.600}",
                $resolvedValue: ROSE,
                $path: "color.brand",
            }),
            "color.danger": token({
                $value: "{color.brand}",
                $resolvedValue: ROSE,
                $path: "color.danger",
            }),
        };

        const out = inlinePrivateReferences(input);

        expect(out["rose.600"]).toBeUndefined();
        expect((out["color.brand"] as ResolvedToken).$value).toBe(ROSE);
        expect((out["color.danger"] as ResolvedToken).$value).toBe("{color.brand}");
    });

    it("v1 literal-only: a private intermediate flattens to a literal even with a public anchor below", () => {
        const input: ResolvedTokens = {
            "color.primary": token({
                $value: PRIMARY,
                $resolvedValue: PRIMARY,
                $path: "color.primary",
            }),
            "color.alias": token({
                $value: "{color.primary}",
                $resolvedValue: PRIMARY,
                $path: "color.alias",
                $source: { sourcePath: "internal.json", emit: false },
            }),
            "color.danger": token({
                $value: "{color.alias}",
                $resolvedValue: PRIMARY,
                $path: "color.danger",
            }),
        };

        const out = inlinePrivateReferences(input);

        expect(out["color.alias"]).toBeUndefined();
        expect((out["color.danger"] as ResolvedToken).$value).toBe(PRIMARY);
        expect((out["color.primary"] as ResolvedToken).$value).toBe(PRIMARY);
    });

    it("decides per leaf for composite tokens", () => {
        const input: ResolvedTokens = {
            "rose.600": token({
                $value: ROSE,
                $resolvedValue: ROSE,
                $path: "rose.600",
                $source: { sourcePath: "raw.json", emit: false },
            }),
            "space.xs": token({
                $type: "dimension",
                $value: "4px",
                $resolvedValue: "4px",
                $path: "space.xs",
            }),
            "shadow.danger": token({
                $type: "shadow",
                $value: {
                    color: "{rose.600}",
                    offsetX: "0px",
                    offsetY: "{space.xs}",
                    blur: "4px",
                    spread: "0px",
                },
                $resolvedValue: {
                    color: ROSE,
                    offsetX: "0px",
                    offsetY: "4px",
                    blur: "4px",
                    spread: "0px",
                },
                $path: "shadow.danger",
            }),
        };

        const out = inlinePrivateReferences(input);

        expect(out["rose.600"]).toBeUndefined();
        expect((out["shadow.danger"] as ResolvedToken).$value).toEqual({
            color: ROSE,
            offsetX: "0px",
            offsetY: "{space.xs}",
            blur: "4px",
            spread: "0px",
        });
    });

    it("drops a private set with no incoming references, without error", () => {
        const input: ResolvedTokens = {
            "rose.600": token({
                $value: ROSE,
                $resolvedValue: ROSE,
                $path: "rose.600",
                $source: { sourcePath: "raw.json", emit: false },
            }),
            "color.text": token({
                $value: "#111111",
                $resolvedValue: "#111111",
                $path: "color.text",
            }),
        };

        const out = inlinePrivateReferences(input);

        expect(out["rose.600"]).toBeUndefined();
        expect((out["color.text"] as ResolvedToken).$value).toBe("#111111");
    });

    it("inlines the per-permutation literal", () => {
        const input: ResolvedTokens = {
            "perm:0.brand.accent": token({
                $value: "#0066cc",
                $resolvedValue: "#0066cc",
                $path: "brand.accent",
                $source: { sourcePath: "brand.json", context: "perm:0", emit: false },
            }),
            "perm:0.color.cta": token({
                $value: "{brand.accent}",
                $resolvedValue: "#0066cc",
                $path: "color.cta",
                $source: { sourcePath: "semantic.json", context: "perm:0" },
            }),
            "perm:1.brand.accent": token({
                $value: "#228b22",
                $resolvedValue: "#228b22",
                $path: "brand.accent",
                $source: { sourcePath: "brand.json", context: "perm:1", emit: false },
            }),
            "perm:1.color.cta": token({
                $value: "{brand.accent}",
                $resolvedValue: "#228b22",
                $path: "color.cta",
                $source: { sourcePath: "semantic.json", context: "perm:1" },
            }),
        };

        const out = inlinePrivateReferences(input);

        expect(out["perm:0.brand.accent"]).toBeUndefined();
        expect(out["perm:1.brand.accent"]).toBeUndefined();
        expect((out["perm:0.color.cta"] as ResolvedToken).$value).toBe("#0066cc");
        expect((out["perm:1.color.cta"] as ResolvedToken).$value).toBe("#228b22");
    });
});
