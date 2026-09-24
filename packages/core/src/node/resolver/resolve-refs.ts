import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve as resolvePath } from "pathe";
import { ErrorMessages } from "../../shared/constants/error-messages.js";
import { stampSourcePath } from "../../shared/compose-trees.js";
import { hasRef } from "../../shared/guards.js";
import { resolveJsonPointer } from "../../shared/json-pointer.js";
import type { SourceRef } from "../../types/load.js";
import type { TokenGroup } from "../../types/dtcg.js";
import type {
    ModifierDefinition,
    ReferenceObject,
    ResolverDocument,
    ResolverError,
    SetDefinition,
    Source,
} from "../../types/resolver.js";
import { isResolverFormat } from "./parse.js";
import { isPrivate, markPrivate } from "./utils.js";

/** Result of resolving a reference. */
export type ResolveResult<T> = {
    content: T;
    sourcePath: string;
    errors: ResolverError[];
};

/** A token file as read once and shared across permutations. */
export type CachedFile = {
    content: unknown;
    text: string;
};

/** The resolver document itself: its path relative to cwd, and its text when it came from a file. */
export type ResolverSource = {
    path: string;
    text?: string;
};

/** Context for reference resolution, tracking visited paths to detect cycles. */
type ResolveContext = {
    document: ResolverDocument;
    basePath: string;
    visitedRefs: Set<string>;
    fileCache: Map<string, CachedFile>;
    /** The resolver document itself, relative to cwd, and its text. */
    resolverPath: string;
    resolverText?: string;
    /** Every source read, in resolution order, as a file and a place in it. */
    sourceRefs: SourceRef[];
    /** The text of each file in `sourceRefs`, keyed by file. */
    texts: Map<string, string>;
};

/**
 * Create a resolution context for resolving references.
 */
export function createResolveContext(
    document: ResolverDocument,
    basePath: string,
    fileCache: Map<string, CachedFile> = new Map(),
    resolver?: ResolverSource,
): ResolveContext {
    return {
        document,
        basePath,
        visitedRefs: new Set(),
        fileCache,
        resolverPath: resolver?.path ?? "",
        resolverText: resolver?.text,
        sourceRefs: [],
        texts: new Map(),
    };
}

/**
 * Resolve a $ref reference to its content.
 */
export async function resolveReference(
    ref: string,
    context: ResolveContext,
): Promise<ResolveResult<TokenGroup | SetDefinition | ModifierDefinition>> {
    if (context.visitedRefs.has(ref)) {
        return errorResult({}, ErrorMessages.RESOLVER.CIRCULAR_REFERENCE(ref), ref);
    }

    context.visitedRefs.add(ref);

    try {
        if (ref.startsWith("#/")) return resolveSameDocumentRef(ref, context);
        if (ref.includes("#/")) return await resolveFileFragmentRef(ref, context);
        return await resolveFileRef(ref, context);
    } finally {
        context.visitedRefs.delete(ref);
    }
}

function resolveSameDocumentRef(
    ref: string,
    context: ResolveContext,
): ResolveResult<SetDefinition | ModifierDefinition> {
    const pointer = ref.slice(2);
    const [collection, name] = pointer.split("/");

    if (!collection || !name || pointer.split("/").length !== 2) {
        return errorResult({ sources: [] }, ErrorMessages.RESOLVER.INVALID_REFERENCE(ref));
    }

    if (collection === "sets") {
        const setDef = context.document.sets?.[name];
        if (!setDef) {
            return errorResult({ sources: [] }, ErrorMessages.RESOLVER.UNDEFINED_SET(name));
        }
        return { content: setDef, sourcePath: "#", errors: [] };
    }

    if (collection === "modifiers") {
        const modifierDef = context.document.modifiers?.[name];
        if (!modifierDef) {
            return errorResult({ contexts: {} }, ErrorMessages.RESOLVER.UNDEFINED_MODIFIER(name));
        }
        return { content: modifierDef, sourcePath: "#", errors: [] };
    }

    return errorResult({ sources: [] }, ErrorMessages.RESOLVER.INVALID_REFERENCE(ref));
}

async function resolveFileRef(
    ref: string,
    context: ResolveContext,
): Promise<ResolveResult<TokenGroup>> {
    const filePath = isAbsolute(ref) ? ref : resolvePath(context.basePath, ref);

    const cached = context.fileCache.get(filePath);
    if (cached) {
        // Check if cached content is a resolver document (shouldn't be used as token source)
        if (isResolverFormat(cached.content)) {
            return errorResult(
                {},
                ErrorMessages.RESOLVER.RESOLVER_AS_TOKEN_SOURCE(filePath),
                filePath,
            );
        }
        return { content: cached.content as TokenGroup, sourcePath: filePath, errors: [] };
    }

    const loadResult = await loadJsonFile(filePath);
    if (loadResult.error !== undefined) {
        return errorResult({}, loadResult.error, filePath);
    }

    // Check if loaded content is a resolver document (shouldn't be used as token source)
    if (isResolverFormat(loadResult.content)) {
        return errorResult({}, ErrorMessages.RESOLVER.RESOLVER_AS_TOKEN_SOURCE(filePath), filePath);
    }

    context.fileCache.set(filePath, { content: loadResult.content, text: loadResult.text });
    return { content: loadResult.content as TokenGroup, sourcePath: filePath, errors: [] };
}

async function resolveFileFragmentRef(
    ref: string,
    context: ResolveContext,
): Promise<ResolveResult<TokenGroup>> {
    const [filePart = "", fragmentPart = ""] = ref.split("#");
    const filePath = isAbsolute(filePart) ? filePart : resolvePath(context.basePath, filePart);

    let fileContent = context.fileCache.get(filePath)?.content;
    if (!fileContent) {
        const loadResult = await loadJsonFile(filePath);
        if (loadResult.error !== undefined) {
            return errorResult({}, loadResult.error, filePath);
        }
        fileContent = loadResult.content;
        context.fileCache.set(filePath, { content: fileContent, text: loadResult.text });
    }

    const pointer = fragmentPart.startsWith("/") ? fragmentPart : `/${fragmentPart}`;
    const result = resolveJsonPointer(fileContent, pointer);

    if (result.error) {
        return errorResult(
            {},
            ErrorMessages.RESOLVER.INVALID_JSON_POINTER(pointer, result.error),
            filePath,
        );
    }

    return { content: result.value as TokenGroup, sourcePath: filePath, errors: [] };
}

type LoadResult =
    | { content: unknown; text: string; error?: undefined }
    | { content?: undefined; text?: undefined; error: string };

async function loadJsonFile(filePath: string): Promise<LoadResult> {
    try {
        const text = await readFile(filePath, "utf-8");
        return { content: JSON.parse(text), text };
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { error: ErrorMessages.RESOLVER.EXTERNAL_FILE_NOT_FOUND(filePath) };
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        return { error: ErrorMessages.RESOLVER.EXTERNAL_FILE_ERROR(filePath, message) };
    }
}

/**
 * Resolve all sources in an array, handling $ref and inline sources.
 * Applies extending (shallow merge) for references with additional properties.
 * `at` is the JSON pointer to the array in the resolver document, so an inline
 * source can say where it was authored.
 */
export async function resolveSources(
    sources: Source[],
    context: ResolveContext,
    at: string,
): Promise<ResolvedSources> {
    const resolved: TokenGroup[] = [];
    const errors: ResolverError[] = [];

    for (const [index, source] of sources.entries()) {
        const result = await resolveSource(source, context, `${at}/${index}`);
        resolved.push(...result.resolved);
        errors.push(...result.errors);
    }

    return { resolved, errors };
}

type ResolvedSources = { resolved: TokenGroup[]; errors: ResolverError[] };

async function resolveSource(
    source: Source,
    context: ResolveContext,
    at: string,
): Promise<ResolvedSources> {
    if (!hasRef(source)) return inlineSource(source as TokenGroup, context, at);
    if (source.$ref.startsWith("#/sets/")) return setSource(source.$ref, context);
    return fileSource(source, context);
}

// Tokens declared inline (spec 4.1.4, 4.1.5.1) are authored in the resolver
// document, so that is the file they came from.
function inlineSource(source: TokenGroup, context: ResolveContext, at: string): ResolvedSources {
    const file = context.resolverPath;
    if (!file) return { resolved: [source], errors: [] };

    recordSource(context, { file, pointer: at }, context.resolverText);
    return { resolved: [stampSourcePath(source, file)], errors: [] };
}

// Per DTCG §4.1.5.1 Example 4: a set ref inside a sources array is equivalent
// to that set's sources being inlined here.
async function setSource(ref: string, context: ResolveContext): Promise<ResolvedSources> {
    const refResult = await resolveReference(ref, context);
    if (refResult.errors.length > 0) return { resolved: [], errors: refResult.errors };
    if (context.visitedRefs.has(ref)) {
        return {
            resolved: [],
            errors: [{ path: ref, message: ErrorMessages.RESOLVER.CIRCULAR_REFERENCE(ref) }],
        };
    }

    const setDef = refResult.content as SetDefinition;
    context.visitedRefs.add(ref);
    try {
        return await resolveSources(
            setDef.sources,
            context,
            `/sets/${ref.slice("#/sets/".length)}/sources`,
        );
    } finally {
        context.visitedRefs.delete(ref);
    }
}

async function fileSource(
    source: ReferenceObject,
    context: ResolveContext,
): Promise<ResolvedSources> {
    const refResult = await resolveReference(source.$ref, context);
    if (refResult.errors.length > 0) return { resolved: [], errors: refResult.errors };

    const file = relative(process.cwd(), refResult.sourcePath);
    const text = context.fileCache.get(refResult.sourcePath)?.text;
    recordSource(context, sourceRefOf(source.$ref, file), text);

    const content = stampSourcePath(applyExtending(refResult.content as TokenGroup, source), file);
    return { resolved: [isPrivate(source) ? markPrivate(content) : content], errors: [] };
}

function sourceRefOf(ref: string, file: string): SourceRef {
    const fragment = ref.split("#")[1];
    if (fragment === undefined) return { file };
    return { file, pointer: fragment.startsWith("/") ? fragment : `/${fragment}` };
}

function recordSource(context: ResolveContext, ref: SourceRef, text?: string): void {
    const seen = context.sourceRefs.some(
        (each) => each.file === ref.file && each.pointer === ref.pointer,
    );
    if (!seen) context.sourceRefs.push(ref);
    if (text !== undefined) context.texts.set(ref.file, text);
}

function applyExtending(content: TokenGroup, refObject: ReferenceObject): TokenGroup {
    const { $ref: _$ref, ...extensions } = refObject;
    if (Object.keys(extensions).length === 0) return content;
    return { ...content, ...extensions } as TokenGroup;
}

export async function resolveDocumentReferences(
    document: ResolverDocument,
    basePath: string,
): Promise<{
    sets: Array<{ name: string; definition: SetDefinition; sources: TokenGroup[] }>;
    modifiers: Array<{
        name: string;
        definition: ModifierDefinition;
        resolvedContexts: Record<string, TokenGroup[]>;
    }>;
    errors: ResolverError[];
}> {
    const context = createResolveContext(document, basePath);
    const sets: Array<{ name: string; definition: SetDefinition; sources: TokenGroup[] }> = [];
    const modifiers: Array<{
        name: string;
        definition: ModifierDefinition;
        resolvedContexts: Record<string, TokenGroup[]>;
    }> = [];
    const errors: ResolverError[] = [];

    for (const [index, item] of document.resolutionOrder.entries()) {
        if (hasRef(item)) {
            await processReferenceItem(item, context, sets, modifiers, errors);
        } else if ("type" in item) {
            await processInlineItem(item, index, context, sets, modifiers, errors);
        }
    }

    return { sets, modifiers, errors };
}

async function processReferenceItem(
    item: { $ref: string },
    context: ResolveContext,
    sets: Array<{ name: string; definition: SetDefinition; sources: TokenGroup[] }>,
    modifiers: Array<{
        name: string;
        definition: ModifierDefinition;
        resolvedContexts: Record<string, TokenGroup[]>;
    }>,
    errors: ResolverError[],
): Promise<void> {
    const refResult = await resolveReference(item.$ref, context);
    errors.push(...refResult.errors);

    if (refResult.errors.length > 0) return;

    const name = item.$ref.split("/")[2];
    if (!name) return;

    if (item.$ref.startsWith("#/sets/")) {
        const definition = refResult.content as SetDefinition;
        const sourcesResult = await resolveSources(
            definition.sources,
            context,
            `/sets/${name}/sources`,
        );
        errors.push(...sourcesResult.errors);
        sets.push({ name, definition, sources: sourcesResult.resolved });
        return;
    }

    if (item.$ref.startsWith("#/modifiers/")) {
        const definition = refResult.content as ModifierDefinition;
        const resolvedContexts = await resolveModifierContexts(
            definition.contexts,
            context,
            `/modifiers/${name}/contexts`,
            errors,
        );
        modifiers.push({ name, definition, resolvedContexts });
    }
}

async function processInlineItem(
    item: {
        type: string;
        name: string;
        sources?: Source[];
        contexts?: Record<string, Source[]>;
        description?: string;
        default?: string;
        $extensions?: Record<string, unknown>;
    },
    index: number,
    context: ResolveContext,
    sets: Array<{ name: string; definition: SetDefinition; sources: TokenGroup[] }>,
    modifiers: Array<{
        name: string;
        definition: ModifierDefinition;
        resolvedContexts: Record<string, TokenGroup[]>;
    }>,
    errors: ResolverError[],
): Promise<void> {
    if (item.type === "set" && item.sources) {
        const sourcesResult = await resolveSources(
            item.sources,
            context,
            `/resolutionOrder/${index}/sources`,
        );
        errors.push(...sourcesResult.errors);
        sets.push({
            name: item.name,
            definition: {
                description: item.description,
                sources: item.sources,
                $extensions: item.$extensions,
            },
            sources: sourcesResult.resolved,
        });
        return;
    }

    if (item.type === "modifier" && item.contexts) {
        const resolvedContexts = await resolveModifierContexts(
            item.contexts,
            context,
            `/resolutionOrder/${index}/contexts`,
            errors,
        );
        modifiers.push({
            name: item.name,
            definition: {
                description: item.description,
                contexts: item.contexts,
                default: item.default,
                $extensions: item.$extensions,
            },
            resolvedContexts,
        });
    }
}

async function resolveModifierContexts(
    contexts: Record<string, Source[]>,
    context: ResolveContext,
    at: string,
    errors: ResolverError[],
): Promise<Record<string, TokenGroup[]>> {
    const resolvedContexts: Record<string, TokenGroup[]> = {};

    for (const [contextName, contextSources] of Object.entries(contexts)) {
        const sourcesResult = await resolveSources(contextSources, context, `${at}/${contextName}`);
        errors.push(...sourcesResult.errors);
        resolvedContexts[contextName] = sourcesResult.resolved;
    }

    return resolvedContexts;
}

function errorResult<T>(content: T, message: string, path = "#"): ResolveResult<T> {
    return { content, sourcePath: path, errors: [{ path, message }] };
}
