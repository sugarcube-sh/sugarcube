import { isInlineModifier, isInlineSet, isReference } from "../guards/resolver-guards.js";
import type { TokenGroup } from "../types/dtcg.js";
import type {
    InlineModifier,
    InlineSet,
    ModifierDefinition,
    ResolverDocument,
    ResolverError,
    ResolverInputs,
    SetDefinition,
    Source,
} from "../types/resolver.js";
import { createResolveContext, resolveReference, resolveSources } from "./resolve-refs.js";
import { deepMerge } from "./utils.js";
import { validateInputs } from "./validate-inputs.js";

type SourceInfo = {
    path: string;
    type: "set" | "modifier";
    name: string;
    context?: string;
};

export type ResolutionOrderResult = {
    tokens: TokenGroup;
    sources: SourceInfo[];
    errors: ResolverError[];
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
    inputs: ResolverInputs = {}
): Promise<ResolutionOrderResult> {
    const validation = validateInputs(document, inputs);
    if (!validation.valid) {
        return {
            tokens: {},
            sources: [],
            errors: validation.errors.map((e) => ({
                path: e.modifier || "inputs",
                message: e.message,
            })),
        };
    }

    const context = createResolveContext(document, basePath);
    const state = createProcessingState();

    for (const item of document.resolutionOrder) {
        await processItem(item, document, context, validation.resolvedInputs, state);
    }

    return {
        tokens: state.tokens,
        sources: state.sources,
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
    document: ResolverDocument,
    context: ResolveContext,
    inputs: ResolverInputs,
    state: ProcessingState
): Promise<void> {
    if (isReference(item)) {
        await processReference(item, document, context, inputs, state);
        return;
    }

    if (isInlineSet(item)) {
        await processInlineSet(item as InlineSet, context, state);
        return;
    }

    if (isInlineModifier(item)) {
        await processInlineModifier(item as InlineModifier, context, inputs, state);
    }
}

async function processReference(
    item: { $ref: string },
    document: ResolverDocument,
    context: ResolveContext,
    inputs: ResolverInputs,
    state: ProcessingState
): Promise<void> {
    const refResult = await resolveReference(item.$ref, context);
    if (refResult.errors.length > 0) {
        state.errors.push(...refResult.errors);
        return;
    }

    const name = item.$ref.split("/")[2];
    if (!name) return;

    if (item.$ref.startsWith("#/sets/")) {
        const result = await mergeSources((refResult.content as SetDefinition).sources, context, {
            type: "set",
            name,
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

        const result = await mergeSources(sources, context, {
            type: "modifier",
            name,
            context: selectedContext,
        });
        applyResult(result, state);
    }
}

async function processInlineSet(
    set: InlineSet,
    context: ResolveContext,
    state: ProcessingState
): Promise<void> {
    const result = await mergeSources(set.sources, context, { type: "set", name: set.name });
    applyResult(result, state);
}

async function processInlineModifier(
    modifier: InlineModifier,
    context: ResolveContext,
    inputs: ResolverInputs,
    state: ProcessingState
): Promise<void> {
    const selectedContext = inputs[modifier.name];
    if (!selectedContext) return;

    const sources = modifier.contexts[selectedContext];
    if (!sources) return;

    const result = await mergeSources(sources, context, {
        type: "modifier",
        name: modifier.name,
        context: selectedContext,
    });
    applyResult(result, state);
}

type SourceMeta = {
    type: "set" | "modifier";
    name: string;
    context?: string;
};

type MergeResult = {
    tokens: TokenGroup;
    source: SourceInfo;
    errors: ResolverError[];
};

async function mergeSources(
    sources: Source[],
    context: ResolveContext,
    meta: SourceMeta
): Promise<MergeResult> {
    const sourcesResult = await resolveSources(sources, context);

    let tokens: TokenGroup = {};
    for (const source of sourcesResult.resolved) {
        tokens = deepMerge(tokens, source);
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
