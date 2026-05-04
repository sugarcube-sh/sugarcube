import {
    type ResolvedTokens,
    type ScaleExtension,
    calculateScale,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";

type Dim = { value: number; unit: "rem" | "px" };

export function applyRecipeOverlay(
    resolved: ResolvedTokens,
    recipe: ScaleExtension,
    parentPath: string,
    pathIndex: PathIndex,
    context: string
): ResolvedTokens {
    const steps = calculateScale(recipe);
    const updates: ResolvedTokens = {};

    for (const step of steps) {
        const stepPath = `${parentPath}.${step.name}`;
        const entries = pathIndex.entriesFor(stepPath).filter((e) => e.context === context);
        for (const { key } of entries) {
            const next = buildRecipeDimensionToken(
                resolved[key],
                step.min,
                step.max,
                recipe.viewport
            );
            if (next) updates[key] = next;
        }
    }

    return { ...resolved, ...updates };
}

function buildRecipeDimensionToken(
    existing: ResolvedTokens[string] | undefined,
    min: Dim,
    max: Dim,
    viewport: { min: number; max: number }
): ResolvedTokens[string] | null {
    if (!isResolvedToken(existing)) return null;

    const existingSugarcube = (existing.$extensions?.["sh.sugarcube"] ?? {}) as Record<
        string,
        unknown
    >;

    return {
        ...existing,
        $value: max,
        $resolvedValue: max,
        $extensions: {
            ...existing.$extensions,
            "sh.sugarcube": {
                ...existingSugarcube,
                fluid: { min, max, viewport },
            },
        },
    } as ResolvedTokens[string];
}
