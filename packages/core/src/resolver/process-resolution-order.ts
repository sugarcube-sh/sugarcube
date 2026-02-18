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
import { deepMerge, extractModifiers } from "./utils.js";
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

/** Information about a modifier for layered CSS generation. */
export type ModifierInfo = {
    name: string;
    defaultContext: string;
    /** Map of context name → tokens defined by that context's sources */
    contexts: Map<string, TokenGroup>;
};

/** Result of processing for layered CSS output. */
export type LayeredResult = {
    /** Tokens from sets + default modifier contexts (go to :root) */
    base: TokenGroup;
    /** Modifier information for generating [data-{modifier}="{context}"] selectors */
    modifiers: ModifierInfo[];
    errors: ResolverError[];
};

/**
 * Process resolution order for layered CSS output.
 *
 * This function processes sets and modifier contexts separately, enabling
 * efficient layered CSS where:
 * - Base tokens (from sets + default contexts) → :root
 * - Each modifier context's tokens → [data-{modifier}="{context}"]
 *
 * This approach:
 * - Supports multiple orthogonal modifiers
 * - Produces minimal CSS (no token duplication)
 * - Relies on CSS cascade for proper value resolution
 */
export async function processForLayeredCSS(
    document: ResolverDocument,
    basePath: string
): Promise<LayeredResult> {
    const errors: ResolverError[] = [];
    const resolveContext = createResolveContext(document, basePath);
    const modifiers = extractModifiers(document);

    // 1. Process base: sets + default modifier contexts
    const baseInputs: ResolverInputs = {};
    for (const mod of modifiers) {
        if (mod.default) {
            baseInputs[mod.name] = mod.default;
        }
    }

    const baseResult = await processResolutionOrder(document, basePath, baseInputs);
    errors.push(...baseResult.errors);
    const base = baseResult.tokens;

    // 2. Process each modifier's non-default contexts
    const modifierInfos: ModifierInfo[] = [];

    for (const mod of modifiers) {
        const modifierContexts = new Map<string, TokenGroup>();
        const defaultContext = mod.default ?? mod.contexts[0] ?? "default";

        for (const contextName of mod.contexts) {
            // Skip default context - it's already in base
            if (contextName === defaultContext) {
                continue;
            }

            // Get the tokens defined by this context's sources
            const contextTokens = await processModifierContext(
                document,
                basePath,
                resolveContext,
                mod.name,
                contextName,
                errors
            );

            if (Object.keys(contextTokens).length > 0) {
                modifierContexts.set(contextName, contextTokens);
            }
        }

        modifierInfos.push({
            name: mod.name,
            defaultContext,
            contexts: modifierContexts,
        });
    }

    return { base, modifiers: modifierInfos, errors };
}

async function processModifierContext(
    document: ResolverDocument,
    basePath: string,
    resolveContext: ResolveContext,
    modifierName: string,
    contextName: string,
    errors: ResolverError[]
): Promise<TokenGroup> {
    const modifierDef = findModifierDefinition(document, modifierName);
    if (!modifierDef) {
        return {};
    }

    const sources = modifierDef.contexts[contextName];
    if (!sources || sources.length === 0) {
        return {};
    }

    const sourcesResult = await resolveSources(sources, resolveContext);
    errors.push(...sourcesResult.errors.map((e) => ({ path: e.path, message: e.message })));

    let rawContextTokens: TokenGroup = {};
    for (const source of sourcesResult.resolved) {
        rawContextTokens = deepMerge(rawContextTokens, source);
    }

    const contextPaths = new Set<string>();
    collectTokenPaths(rawContextTokens, "", contextPaths);

    const fullResult = await processResolutionOrder(document, basePath, {
        [modifierName]: contextName,
    });
    errors.push(...fullResult.errors);

    const contextTokens: TokenGroup = {};
    for (const path of contextPaths) {
        const value = getTokenAtPath(fullResult.tokens, path);
        if (value !== undefined) {
            setTokenAtPath(contextTokens, path, value);
        }
    }

    return contextTokens;
}

function findModifierDefinition(
    document: ResolverDocument,
    name: string
): ModifierDefinition | InlineModifier | undefined {
    // Check root-level modifiers
    if (document.modifiers?.[name]) {
        return document.modifiers[name];
    }

    // Check inline modifiers in resolutionOrder
    for (const item of document.resolutionOrder) {
        if (isInlineModifier(item) && (item as InlineModifier).name === name) {
            return item as InlineModifier;
        }
    }

    return undefined;
}

function collectTokenPaths(tokens: TokenGroup, prefix: string, paths: Set<string>): void {
    for (const [key, value] of Object.entries(tokens)) {
        if (key.startsWith("$")) continue;

        const path = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === "object" && "$value" in value) {
            paths.add(path);
        } else if (value && typeof value === "object") {
            collectTokenPaths(value as TokenGroup, path, paths);
        }
    }
}

function getTokenAtPath(tokens: TokenGroup, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = tokens;

    for (const part of parts) {
        if (current === null || typeof current !== "object") {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

function setTokenAtPath(tokens: TokenGroup, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = tokens;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;
        if (!(part in current)) {
            current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
        current[lastPart] = value;
    }
}
