import { readFile } from "node:fs/promises";
import { isAbsolute, resolve as resolvePath } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import { isReference } from "../guards/resolver-guards.js";
import type { TokenGroup } from "../types/dtcg.js";
import type {
    ModifierDefinition,
    ReferenceObject,
    ResolverDocument,
    ResolverError,
    SetDefinition,
    Source,
} from "../types/resolver.js";
import { isResolverFormat } from "./parse-resolver.js";

/** Result of resolving a reference. */
export type ResolveResult<T> = {
    content: T;
    sourcePath: string;
    errors: ResolverError[];
};

/** Context for reference resolution, tracking visited paths to detect cycles. */
type ResolveContext = {
    document: ResolverDocument;
    basePath: string;
    visitedRefs: Set<string>;
    fileCache: Map<string, unknown>;
};

/**
 * Create a resolution context for resolving references.
 */
export function createResolveContext(document: ResolverDocument, basePath: string): ResolveContext {
    return { document, basePath, visitedRefs: new Set(), fileCache: new Map() };
}

/**
 * Resolve a $ref reference to its content.
 */
export async function resolveReference(
    ref: string,
    context: ResolveContext
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
    context: ResolveContext
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
    context: ResolveContext
): Promise<ResolveResult<TokenGroup>> {
    const filePath = isAbsolute(ref) ? ref : resolvePath(context.basePath, ref);

    const cached = context.fileCache.get(filePath);
    if (cached) {
        // Check if cached content is a resolver document (shouldn't be used as token source)
        if (isResolverFormat(cached)) {
            return errorResult(
                {},
                ErrorMessages.RESOLVER.RESOLVER_AS_TOKEN_SOURCE(filePath),
                filePath
            );
        }
        return { content: cached as TokenGroup, sourcePath: filePath, errors: [] };
    }

    const loadResult = await loadJsonFile(filePath);
    if (loadResult.error) {
        return errorResult({}, loadResult.error, filePath);
    }

    // Check if loaded content is a resolver document (shouldn't be used as token source)
    if (isResolverFormat(loadResult.content)) {
        return errorResult({}, ErrorMessages.RESOLVER.RESOLVER_AS_TOKEN_SOURCE(filePath), filePath);
    }

    context.fileCache.set(filePath, loadResult.content);
    return { content: loadResult.content as TokenGroup, sourcePath: filePath, errors: [] };
}

async function resolveFileFragmentRef(
    ref: string,
    context: ResolveContext
): Promise<ResolveResult<TokenGroup>> {
    const [filePart = "", fragmentPart = ""] = ref.split("#");
    const filePath = isAbsolute(filePart) ? filePart : resolvePath(context.basePath, filePart);

    let fileContent = context.fileCache.get(filePath);
    if (!fileContent) {
        const loadResult = await loadJsonFile(filePath);
        if (loadResult.error) {
            return errorResult({}, loadResult.error, filePath);
        }
        fileContent = loadResult.content;
        context.fileCache.set(filePath, fileContent);
    }

    const pointer = fragmentPart.startsWith("/") ? fragmentPart : `/${fragmentPart}`;
    const result = resolveJsonPointer(fileContent, pointer);

    if (result.error) {
        return errorResult(
            {},
            ErrorMessages.RESOLVER.INVALID_JSON_POINTER(pointer, result.error),
            filePath
        );
    }

    return { content: result.value as TokenGroup, sourcePath: filePath, errors: [] };
}

type LoadResult = { content: unknown; error?: undefined } | { content?: undefined; error: string };

async function loadJsonFile(filePath: string): Promise<LoadResult> {
    try {
        const content = await readFile(filePath, "utf-8");
        return { content: JSON.parse(content) };
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { error: ErrorMessages.RESOLVER.EXTERNAL_FILE_NOT_FOUND(filePath) };
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        return { error: ErrorMessages.RESOLVER.EXTERNAL_FILE_ERROR(filePath, message) };
    }
}

type PointerResult = { value: unknown; error?: undefined } | { value?: undefined; error: string };

function resolveJsonPointer(obj: unknown, pointer: string): PointerResult {
    if (pointer === "" || pointer === "/") return { value: obj };

    const segments = pointer
        .slice(1)
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

    let current: unknown = obj;

    for (const segment of segments) {
        if (current === null || typeof current !== "object") {
            return { error: "cannot navigate into non-object" };
        }

        if (Array.isArray(current)) {
            const index = Number.parseInt(segment, 10);
            if (Number.isNaN(index) || index < 0 || index >= current.length) {
                return { error: `invalid array index "${segment}"` };
            }
            current = current[index];
            continue;
        }

        const record = current as Record<string, unknown>;
        if (!(segment in record)) {
            return { error: `property "${segment}" not found` };
        }
        current = record[segment];
    }

    return { value: current };
}

/**
 * Resolve all sources in an array, handling $ref and inline sources.
 * Applies extending (shallow merge) for references with additional properties.
 */
export async function resolveSources(
    sources: Source[],
    context: ResolveContext
): Promise<{ resolved: TokenGroup[]; errors: ResolverError[] }> {
    const resolved: TokenGroup[] = [];
    const errors: ResolverError[] = [];

    for (const source of sources) {
        if (!isReference(source)) {
            resolved.push(source as TokenGroup);
            continue;
        }

        const refResult = await resolveReference(source.$ref, context);
        errors.push(...refResult.errors);

        if (refResult.errors.length === 0) {
            resolved.push(applyExtending(refResult.content as TokenGroup, source));
        }
    }

    return { resolved, errors };
}

/**
 * Apply extending properties from a reference object to resolved content.
 * Per DTCG spec section 4.2.2: shallow merge (objects/arrays are NOT deep-merged).
 */
function applyExtending(content: TokenGroup, refObject: ReferenceObject): TokenGroup {
    const { $ref, ...extensions } = refObject;
    if (Object.keys(extensions).length === 0) return content;
    return { ...content, ...extensions } as TokenGroup;
}

export async function resolveDocumentReferences(
    document: ResolverDocument,
    basePath: string
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

    for (const item of document.resolutionOrder) {
        if (isReference(item)) {
            await processReferenceItem(item, context, sets, modifiers, errors);
        } else if ("type" in item) {
            await processInlineItem(item, context, sets, modifiers, errors);
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
    errors: ResolverError[]
): Promise<void> {
    const refResult = await resolveReference(item.$ref, context);
    errors.push(...refResult.errors);

    if (refResult.errors.length > 0) return;

    const name = item.$ref.split("/")[2];
    if (!name) return;

    if (item.$ref.startsWith("#/sets/")) {
        const definition = refResult.content as SetDefinition;
        const sourcesResult = await resolveSources(definition.sources, context);
        errors.push(...sourcesResult.errors);
        sets.push({ name, definition, sources: sourcesResult.resolved });
        return;
    }

    if (item.$ref.startsWith("#/modifiers/")) {
        const definition = refResult.content as ModifierDefinition;
        const resolvedContexts = await resolveModifierContexts(
            definition.contexts,
            context,
            errors
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
    context: ResolveContext,
    sets: Array<{ name: string; definition: SetDefinition; sources: TokenGroup[] }>,
    modifiers: Array<{
        name: string;
        definition: ModifierDefinition;
        resolvedContexts: Record<string, TokenGroup[]>;
    }>,
    errors: ResolverError[]
): Promise<void> {
    if (item.type === "set" && item.sources) {
        const sourcesResult = await resolveSources(item.sources, context);
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
        const resolvedContexts = await resolveModifierContexts(item.contexts, context, errors);
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
    errors: ResolverError[]
): Promise<Record<string, TokenGroup[]>> {
    const resolvedContexts: Record<string, TokenGroup[]> = {};

    for (const [contextName, contextSources] of Object.entries(contexts)) {
        const sourcesResult = await resolveSources(contextSources, context);
        errors.push(...sourcesResult.errors);
        resolvedContexts[contextName] = sourcesResult.resolved;
    }

    return resolvedContexts;
}

function errorResult<T>(content: T, message: string, path = "#"): ResolveResult<T> {
    return { content, sourcePath: path, errors: [{ path, message }] };
}
