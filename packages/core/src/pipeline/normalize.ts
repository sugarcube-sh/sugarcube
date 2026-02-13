import type { NormalizeResult, NormalizedTokens } from "../types/normalize.js";
import type { ProcessedTree } from "../types/process-trees.js";

/** Organizes processed tokens by context (e.g., { default: {...}, dark: {...} }). */
export function normalizeTokens(trees: ProcessedTree[], defaultContext?: string): NormalizeResult {
    const result: NormalizedTokens = {};

    const contexts = new Set<string>();
    for (const tree of trees) {
        const contextName = tree.context ?? "default";
        contexts.add(contextName);
    }

    for (const contextName of contexts) {
        result[contextName] = {};
    }

    for (const tree of trees) {
        const { context, tokens } = tree;
        const contextName = context ?? "default";

        if (!result[contextName]) {
            result[contextName] = {};
        }

        for (const [key, token] of Object.entries(tokens)) {
            result[contextName][key] = token;
        }
    }

    return { tokens: result, defaultContext };
}
