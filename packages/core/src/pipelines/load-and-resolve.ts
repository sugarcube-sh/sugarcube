import { expandTree } from "../pipeline/expand-tree.js";
import { flatten } from "../pipeline/flatten.js";
import { loadFromResolver } from "../pipeline/load-resolver.js";
import { loadTreesFromMemory } from "../pipeline/load.js";
import { parseResolver } from "../pipeline/parse-resolver.js";
import { resolve } from "../pipeline/resolve.js";
import { validate } from "../pipeline/validate.js";
import type {
    PipelineContext,
    PipelineResult,
    PipelineWarning,
    TokenPipelineSource,
} from "../types/pipelines.js";
import { createPipelineContext } from "../types/pipelines.js";
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
 * 1. Parses the resolver document (if using resolver source)
 * 2. Loads token trees from resolver document or memory
 * 3. Flattens trees into a single structure
 * 4. Validates tokens for correctness
 * 5. Resolves all token references
 *
 * @param source - The source of tokens to process (resolver or memory)
 * @param context - Optional pipeline context for warnings and events.
 *   If not provided, a default context is created internally.
 * @returns Processed tokens and any errors
 */
export async function loadAndResolveTokens(
    source: TokenPipelineSource,
    context?: PipelineContext
): Promise<LoadAndResolveResult> {
    const ctx = context ?? createPipelineContext();

    const { trees, errors: loadErrors } = await loadTokens(source, ctx);

    const { trees: expandedTrees, errors: expandTreeErrors } = expandTree(trees);

    const { tokens: flattenedTokens, errors: flattenErrors } = flatten(expandedTrees);
    const validationErrors = validate(flattenedTokens, ctx);

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
        warnings: ctx.warnings,
    };
}

type LoadResult = {
    trees: TokenTree[];
    errors: PipelineResult["errors"]["load"];
};

async function loadTokens(
    source: TokenPipelineSource,
    context: PipelineContext
): Promise<LoadResult> {
    switch (source.type) {
        case "memory": {
            const result = await loadTreesFromMemory(source.data);
            return { trees: result.trees, errors: result.errors };
        }
        case "resolver": {
            const { document, errors: parseErrors } = await parseResolver(
                source.resolverPath,
                context
            );
            if (parseErrors) return { trees: [], errors: parseErrors };

            const result = await loadFromResolver(
                document,
                source.resolverPath,
                source.config.variables.permutations
            );

            // We set the resolved permutations on the config so generate can use them
            source.config.variables.permutations = result.permutations;

            return {
                trees: result.trees,
                errors: result.errors,
            };
        }
    }
}
