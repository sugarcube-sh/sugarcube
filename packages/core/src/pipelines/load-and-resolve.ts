import { flatten } from "../pipeline/flatten.js";
import { loadFromResolver } from "../pipeline/load-resolver.js";
import { loadTreesFromMemory } from "../pipeline/load.js";
import { resolve } from "../pipeline/resolve.js";
import { validate } from "../pipeline/validate.js";
import type { ModifierMeta, PipelineResult, TokenPipelineSource } from "../types/pipelines.js";
import type { ResolvedTokens } from "../types/resolve.js";
import type { TokenTree } from "../types/tokens.js";

/**
 * Result of loading and resolving tokens.
 */
export type LoadAndResolveResult = {
    /** The loaded token trees */
    trees: TokenTree[];
    /** Resolved tokens after reference resolution */
    resolved: ResolvedTokens;
    /** Modifier metadata for CSS selector generation */
    modifiers: ModifierMeta[];
    /** Any errors that occurred */
    errors: PipelineResult["errors"];
};

/**
 * Core token processing pipeline that handles loading, validation, and resolution.
 *
 * This pipeline:
 * 1. Loads token trees from resolver document or memory
 * 2. Flattens trees into a single structure
 * 3. Validates tokens for correctness
 * 4. Resolves all token references
 *
 * For resolver sources, loads ALL contexts (not just default) and returns
 * modifier metadata needed for CSS selector generation.
 *
 * @param source - The source of tokens to process (resolver or memory)
 * @returns Processed tokens with modifier metadata and any errors
 *
 * @example
 * const result = await loadAndResolveTokens({
 *   type: "resolver",
 *   resolverPath: "tokens.resolver.json",
 *   config
 * });
 * // result.trees - all token trees (base + modifier contexts)
 * // result.modifiers - metadata for CSS selectors
 */
export async function loadAndResolveTokens(
    source: TokenPipelineSource
): Promise<LoadAndResolveResult> {
    const { trees, modifiers, errors: loadErrors } = await loadTokens(source);

    const { tokens: flattenedTokens, errors: flattenErrors } = flatten(trees);
    const validationErrors = validate(flattenedTokens);

    const { resolved, errors: resolutionErrors } = resolve(flattenedTokens);

    return {
        trees,
        resolved,
        modifiers,
        errors: {
            load: loadErrors,
            flatten: flattenErrors,
            validation: validationErrors,
            resolution: resolutionErrors,
        },
    };
}

type LoadResult = {
    trees: TokenTree[];
    modifiers: ModifierMeta[];
    errors: PipelineResult["errors"]["load"];
};

async function loadTokens(source: TokenPipelineSource): Promise<LoadResult> {
    switch (source.type) {
        case "memory": {
            const result = await loadTreesFromMemory(source.data);
            return { trees: result.trees, modifiers: [], errors: result.errors };
        }
        case "resolver": {
            const result = await loadFromResolver(source.resolverPath);
            return { trees: result.trees, modifiers: result.modifiers, errors: result.errors };
        }
    }
}
