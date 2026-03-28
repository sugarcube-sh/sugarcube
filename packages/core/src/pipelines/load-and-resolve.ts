import { expandTree } from "../pipeline/expand-tree.js";
import { flatten } from "../pipeline/flatten.js";
import { loadFromResolver } from "../pipeline/load-resolver.js";
import { loadTreesFromMemory } from "../pipeline/load.js";
import { resolve } from "../pipeline/resolve.js";
import { validate } from "../pipeline/validate.js";
import type { PipelineResult, PipelineWarning, TokenPipelineSource } from "../types/pipelines.js";
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
    /** Any errors that occurred */
    errors: PipelineResult["errors"];
    /** Non-blocking warnings */
    warnings: PipelineWarning[];
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
 * @param source - The source of tokens to process (resolver or memory)
 * @returns Processed tokens and any errors
 */
export async function loadAndResolveTokens(
    source: TokenPipelineSource
): Promise<LoadAndResolveResult> {
    const { trees, errors: loadErrors, warnings } = await loadTokens(source);

    const { trees: expandedTrees, errors: expandTreeErrors } = expandTree(trees);

    const { tokens: flattenedTokens, errors: flattenErrors } = flatten(expandedTrees);
    const validationErrors = validate(flattenedTokens);

    const { resolved, errors: resolutionErrors } = resolve(flattenedTokens);

    return {
        trees: expandedTrees,
        resolved,
        errors: {
            load: loadErrors,
            expandTree: expandTreeErrors,
            flatten: flattenErrors,
            validation: validationErrors,
            resolution: resolutionErrors,
        },
        warnings,
    };
}

type LoadResult = {
    trees: TokenTree[];
    errors: PipelineResult["errors"]["load"];
    warnings: PipelineWarning[];
};

async function loadTokens(source: TokenPipelineSource): Promise<LoadResult> {
    switch (source.type) {
        case "memory": {
            const result = await loadTreesFromMemory(source.data);
            return { trees: result.trees, errors: result.errors, warnings: [] };
        }
        case "resolver": {
            const result = await loadFromResolver(
                source.resolverPath,
                source.config.variables.permutations
            );
            // We set the resolved permutations on the config so generate can use them
            source.config.variables.permutations = result.permutations;
            return {
                trees: result.trees,
                errors: result.errors,
                warnings: result.warnings,
            };
        }
    }
}
