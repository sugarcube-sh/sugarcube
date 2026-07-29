import type { PipelineContext, PipelineResult, PipelineWarning } from "../types/pipelines.js";
import { createPipelineContext } from "../types/pipelines.js";
import type { ResolutionError, ResolvedTokens } from "../types/resolve.js";
import type { TokenSource, TokenTree } from "../types/tokens.js";
import { ErrorMessages } from "./constants/error-messages.js";
import { dereference } from "./pipeline/dereference.js";
import { expand } from "./pipeline/expand.js";
import { flatten } from "./pipeline/flatten.js";
import { validate } from "./pipeline/validate.js";

/** Errors produced by the resolve pipeline (everything after loading). */
export type ResolveErrors = Omit<PipelineResult["errors"], "load">;

const PERM_PREFIX = /perm:\d+\./g;

function dedupeResolutionErrors(errors: ResolutionError[]): ResolutionError[] {
    if (errors.length < 2) return errors;

    const seen = new Set<string>();
    const out: ResolutionError[] = [];
    for (const error of errors) {
        const signature = [
            error.type,
            error.message.replace(PERM_PREFIX, ""),
            error.path.replace(PERM_PREFIX, ""),
            error.source.sourcePath,
        ].join("\u0000");

        if (seen.has(signature)) continue;
        seen.add(signature);
        out.push(error);
    }
    return out;
}

function groupMissingReferences(errors: ResolutionError[]): ResolutionError[] {
    const groups = new Map<string, { source: TokenSource; referrers: Set<string> }>();
    const others: ResolutionError[] = [];

    for (const error of errors) {
        if (error.type === "missing" && error.ref) {
            let group = groups.get(error.ref);
            if (!group) {
                group = { source: error.source, referrers: new Set() };
                groups.set(error.ref, group);
            }
            group.referrers.add(error.path.replace(PERM_PREFIX, ""));
        } else {
            others.push(error);
        }
    }

    const grouped: ResolutionError[] = [];
    for (const [ref, { source, referrers }] of groups) {
        const referencedBy = [...referrers].sort();
        grouped.push({
            type: "missing",
            path: ref,
            source,
            ref,
            referencedBy,
            message: ErrorMessages.RESOLVE.MISSING_REFERENCE(ref, referencedBy),
        });
    }

    return [...grouped, ...dedupeResolutionErrors(others)];
}

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
            resolution: groupMissingReferences(resolutionErrors),
        },
        warnings: ctx.warnings,
    };
}
