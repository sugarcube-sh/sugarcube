import { hasRef, isInlineModifier, isInlineSet } from "../../shared/guards.js";
import type { TokenGroup } from "../../types/dtcg.js";
import type { SourceRef } from "../../types/load.js";
import type {
    InlineModifier,
    InlineSet,
    ModifierDefinition,
    ResolverDocument,
    ResolverError,
    ResolverInputs,
    SetDefinition,
    Source,
} from "../../types/resolver.js";
import { deepMerge } from "../../shared/compose-trees.js";
import {
    type CachedFile,
    type ResolverSource,
    createResolveContext,
    resolveReference,
    resolveSources,
} from "./resolve-refs.js";
import { isPrivate, markPrivate } from "./utils.js";
import { validateInputs } from "./validate-inputs.js";

type SourceInfo = {
    path: string;
    type: "set" | "modifier";
    name: string;
    context?: string;
    emit?: boolean;
};

export type ResolutionOrderResult = {
    tokens: TokenGroup;
    sources: SourceInfo[];
    errors: ResolverError[];
    /** Every source this input read, in resolution order, as a file and a place in it. */
    sourceRefs: SourceRef[];
    /** The text of each file read, keyed by file. */
    texts: Map<string, string>;
};

type ResolveContext = ReturnType<typeof createResolveContext>;

/**
 * Process the resolution order to produce merged tokens.
 *
 * Per DTCG spec section 6:
 * 1. Process sets and modifiers in resolutionOrder array order
 * 2. For sets: merge all sources in order
 * 3. For modifiers: select context based on input, merge those sources
 * 4. Last occurrence wins for conflicts
 * 5. Aliases are NOT resolved here (done later per spec section 6.3)
 */
export async function processResolutionOrder(
    document: ResolverDocument,
    basePath: string,
    inputs: ResolverInputs = {},
    fileCache?: Map<string, CachedFile>,
    resolver?: ResolverSource,
): Promise<ResolutionOrderResult> {
    const validation = validateInputs(document, inputs);
    if (!validation.valid) {
        return {
            tokens: {},
            sources: [],
            sourceRefs: [],
            texts: new Map(),
            errors: validation.errors.map((e) => ({
                path: e.modifier || "inputs",
                message: e.message,
            })),
        };
    }

    const context = createResolveContext(document, basePath, fileCache, resolver);
    const state = createProcessingState();

    for (const [index, item] of document.resolutionOrder.entries()) {
        await processItem(item, index, document, context, validation.resolvedInputs, state);
    }

    return {
        tokens: state.tokens,
        sources: state.sources,
        sourceRefs: context.sourceRefs,
        texts: context.texts,
        errors: state.errors,
    };
}

type ProcessingState = {
    tokens: TokenGroup;
    sources: SourceInfo[];
    errors: ResolverError[];
};

function createProcessingState(): ProcessingState {
    return { tokens: {}, sources: [], errors: [] };
}

async function processItem(
    item: unknown,
    index: number,
    document: ResolverDocument,
    context: ResolveContext,
    inputs: ResolverInputs,
    state: ProcessingState,
): Promise<void> {
    if (hasRef(item)) {
        await processReference(item, document, context, inputs, state);
        return;
    }

    if (isInlineSet(item)) {
        await processInlineSet(item as InlineSet, index, context, state);
        return;
    }

    if (isInlineModifier(item)) {
        await processInlineModifier(item as InlineModifier, index, context, inputs, state);
    }
}

async function processReference(
    item: { $ref: string },
    document: ResolverDocument,
    context: ResolveContext,
    inputs: ResolverInputs,
    state: ProcessingState,
): Promise<void> {
    const refResult = await resolveReference(item.$ref, context);
    if (refResult.errors.length > 0) {
        state.errors.push(...refResult.errors);
        return;
    }

    const name = item.$ref.split("/")[2];
    if (!name) return;

    if (item.$ref.startsWith("#/sets/")) {
        const def = refResult.content as SetDefinition;
        const result = await mergeSources(def.sources, context, `/sets/${name}/sources`, {
            type: "set",
            name,
            emit: !isPrivate(def),
        });
        applyResult(result, state);
        return;
    }

    if (item.$ref.startsWith("#/modifiers/")) {
        const selectedContext = inputs[name];
        if (!selectedContext) return;

        const definition = refResult.content as ModifierDefinition;
        const sources = definition.contexts[selectedContext];
        if (!sources) return;

        const result = await mergeSources(
            sources,
            context,
            `/modifiers/${name}/contexts/${selectedContext}`,
            { type: "modifier", name, context: selectedContext },
        );
        applyResult(result, state);
    }
}

async function processInlineSet(
    set: InlineSet,
    index: number,
    context: ResolveContext,
    state: ProcessingState,
): Promise<void> {
    const result = await mergeSources(set.sources, context, `/resolutionOrder/${index}/sources`, {
        type: "set",
        name: set.name,
        emit: !isPrivate(set),
    });
    applyResult(result, state);
}

async function processInlineModifier(
    modifier: InlineModifier,
    index: number,
    context: ResolveContext,
    inputs: ResolverInputs,
    state: ProcessingState,
): Promise<void> {
    const selectedContext = inputs[modifier.name];
    if (!selectedContext) return;

    const sources = modifier.contexts[selectedContext];
    if (!sources) return;

    const result = await mergeSources(
        sources,
        context,
        `/resolutionOrder/${index}/contexts/${selectedContext}`,
        { type: "modifier", name: modifier.name, context: selectedContext },
    );
    applyResult(result, state);
}

type SourceMeta = {
    type: "set" | "modifier";
    name: string;
    context?: string;
    emit?: boolean;
};

type MergeResult = {
    tokens: TokenGroup;
    source: SourceInfo;
    errors: ResolverError[];
};

async function mergeSources(
    sources: Source[],
    context: ResolveContext,
    at: string,
    meta: SourceMeta,
): Promise<MergeResult> {
    const sourcesResult = await resolveSources(sources, context, at);

    let tokens: TokenGroup = {};
    for (const source of sourcesResult.resolved) {
        tokens = deepMerge(tokens, source);
    }

    if (meta.emit === false) {
        tokens = markPrivate(tokens);
    }

    return {
        tokens,
        source: { path: "#", ...meta },
        errors: sourcesResult.errors,
    };
}

function applyResult(result: MergeResult, state: ProcessingState): void {
    state.errors.push(...result.errors);
    state.tokens = deepMerge(state.tokens, result.tokens);
    state.sources.push(result.source);
}
