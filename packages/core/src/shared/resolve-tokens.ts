import type { PipelineContext, PipelineResult, PipelineWarning } from "../types/pipelines.js";
import { createPipelineContext } from "../types/pipelines.js";
import type { ResolvedTokens } from "../types/resolve.js";
import type { TokenTree } from "../types/tokens.js";
import { dereference } from "./pipeline/dereference.js";
import { expand } from "./pipeline/expand.js";
import { flatten } from "./pipeline/flatten.js";
import { validate } from "./pipeline/validate.js";

/** Errors produced by the resolve pipeline (everything after loading). */
export type ResolveErrors = Omit<PipelineResult["errors"], "load">;

export type ResolveResult = {
    /** The expanded token trees — passed through for downstream stages. */
    trees: TokenTree[];
    /** Resolved tokens after reference dereferencing. */
    resolved: ResolvedTokens;
    /** Errors encountered during expand / flatten / validate / dereference. */
    errors: ResolveErrors;
    /** Non-blocking warnings. */
    warnings: PipelineWarning[];
};

/**
 * Pure pipeline: `TokenTree[]` → resolved tokens.
 *
 * Runs expand → flatten → validate → dereference. No filesystem or Node
 * globals, so this is safe to call in browsers, workers, or edge functions.
 *
 * @param trees - The token trees to resolve
 * @param context - Optional pipeline context for warnings/events. Created
 *   internally if omitted.
 */
export function resolveTokens(trees: TokenTree[], context?: PipelineContext): ResolveResult {
    const ctx = context ?? createPipelineContext();

    const { trees: expandedTrees, errors: expandTreeErrors } = expand(trees);
    const { tokens: flattenedTokens, errors: flattenErrors } = flatten(expandedTrees, ctx);
    const validationErrors = validate(flattenedTokens, ctx);
    const { resolved, errors: resolutionErrors } = dereference(flattenedTokens);

    return {
        trees: expandedTrees,
        resolved,
        errors: {
            expandTree: expandTreeErrors,
            flatten: flattenErrors,
            validation: validationErrors,
            resolution: resolutionErrors,
        },
        warnings: ctx.warnings,
    };
}
