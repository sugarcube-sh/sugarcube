import { readFile } from "node:fs/promises";
import { isAbsolute, resolve as resolvePath } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import { isInlineModifier, isInlineSet, isReference } from "../guards/resolver-guards.js";
import { resolverDocumentSchema } from "../schemas/resolver.js";
import type {
    InlineModifier,
    InlineSet,
    ModifierDefinition,
    ResolverDocument,
    ResolverError,
} from "../types/resolver.js";

export type ParseResult = {
    document: ResolverDocument;
    errors: ResolverError[];
};

export async function parseResolverDocument(resolverPath: string): Promise<ParseResult> {
    const absolutePath = isAbsolute(resolverPath)
        ? resolverPath
        : resolvePath(process.cwd(), resolverPath);

    const rawContent = await loadFile(absolutePath);
    if (rawContent.error) {
        return { document: createEmptyDocument(), errors: [rawContent.error] };
    }

    const parsed = parseJson(rawContent.content);
    if (parsed.error) {
        return { document: createEmptyDocument(), errors: [parsed.error] };
    }

    const validated = validateSchema(parsed.data);
    if (validated.errors.length > 0) {
        return { document: createEmptyDocument(), errors: validated.errors };
    }

    const errors: ResolverError[] = [];
    validateDocument(validated.document, errors);

    return { document: validated.document, errors };
}

export function parseResolverDocumentFromString(jsonContent: string): ParseResult {
    const parsed = parseJson(jsonContent);
    if (parsed.error) {
        return { document: createEmptyDocument(), errors: [parsed.error] };
    }

    const validated = validateSchema(parsed.data);
    if (validated.errors.length > 0) {
        return { document: createEmptyDocument(), errors: validated.errors };
    }

    const errors: ResolverError[] = [];
    validateDocument(validated.document, errors);

    return { document: validated.document, errors };
}

type LoadResult =
    | { content: string; error?: undefined }
    | { content?: undefined; error: ResolverError };

async function loadFile(path: string): Promise<LoadResult> {
    try {
        return { content: await readFile(path, "utf-8") };
    } catch {
        return {
            error: { path, message: ErrorMessages.RESOLVER.FILE_NOT_FOUND(path) },
        };
    }
}

type ParseJsonResult =
    | { data: unknown; error?: undefined }
    | { data?: undefined; error: ResolverError };

function parseJson(content: string): ParseJsonResult {
    try {
        return { data: JSON.parse(content) };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
            error: { path: "resolver", message: ErrorMessages.RESOLVER.INVALID_JSON(message) },
        };
    }
}

type ValidateResult = { document: ResolverDocument; errors: ResolverError[] };

function validateSchema(data: unknown): ValidateResult {
    const validation = resolverDocumentSchema.safeParse(data);

    if (!validation.success) {
        const errors: ResolverError[] = validation.error.errors.map((err) => {
            const path = err.path.join(".") || "resolver";
            return {
                path,
                message: `Resolver error at ${path}: ${err.message}. See https://sugarcube.sh/docs/resolver`,
            };
        });
        return { document: createEmptyDocument(), errors };
    }

    return { document: validation.data as ResolverDocument, errors: [] };
}

function validateDocument(document: ResolverDocument, errors: ResolverError[]): void {
    validateModifierContexts(document, errors);
    validateNameUniqueness(document, errors);
    validateReferences(document, errors);
}

function validateModifierContexts(document: ResolverDocument, errors: ResolverError[]): void {
    if (document.modifiers) {
        for (const [name, modifier] of Object.entries(document.modifiers)) {
            checkModifierContexts(modifier, `modifiers.${name}`, errors);
        }
    }

    for (let i = 0; i < document.resolutionOrder.length; i++) {
        const item = document.resolutionOrder[i];
        if (isInlineModifier(item)) {
            checkModifierContexts(item, `resolutionOrder[${i}]`, errors);
        }
    }
}

function checkModifierContexts(
    modifier: ModifierDefinition | InlineModifier,
    path: string,
    errors: ResolverError[]
): void {
    const contextCount = Object.keys(modifier.contexts).length;

    if (contextCount === 0) {
        errors.push({
            path: `${path}.contexts`,
            message: ErrorMessages.RESOLVER.MODIFIER_NEEDS_CONTEXTS,
        });
        return;
    }

    if (contextCount === 1) {
        errors.push({
            path: `${path}.contexts`,
            message: ErrorMessages.RESOLVER.MODIFIER_SINGLE_CONTEXT,
        });
    }

    if (modifier.default && !modifier.contexts[modifier.default]) {
        errors.push({
            path: `${path}.default`,
            message: ErrorMessages.RESOLVER.INVALID_DEFAULT(
                modifier.default,
                Object.keys(modifier.contexts)
            ),
        });
    }
}

function validateNameUniqueness(document: ResolverDocument, errors: ResolverError[]): void {
    const names = new Set<string>();

    for (let i = 0; i < document.resolutionOrder.length; i++) {
        const item = document.resolutionOrder[i];
        if (isReference(item)) continue;

        const name = (item as InlineSet | InlineModifier).name;
        if (names.has(name)) {
            errors.push({
                path: `resolutionOrder[${i}].name`,
                message: ErrorMessages.RESOLVER.DUPLICATE_NAME(name),
            });
        }
        names.add(name);
    }
}

function validateReferences(document: ResolverDocument, errors: ResolverError[]): void {
    for (let i = 0; i < document.resolutionOrder.length; i++) {
        const item = document.resolutionOrder[i];

        if (isReference(item)) {
            validateReference(item.$ref, `resolutionOrder[${i}].$ref`, document, errors);
        } else if (isInlineSet(item)) {
            validateSourcesReferences(item.sources, `resolutionOrder[${i}].sources`, errors);
        } else if (isInlineModifier(item)) {
            for (const [contextName, sources] of Object.entries(item.contexts)) {
                validateSourcesReferences(
                    sources,
                    `resolutionOrder[${i}].contexts.${contextName}`,
                    errors
                );
            }
        }
    }

    if (document.sets) {
        for (const [name, set] of Object.entries(document.sets)) {
            validateSourcesReferences(set.sources, `sets.${name}.sources`, errors);
        }
    }

    if (document.modifiers) {
        for (const [name, modifier] of Object.entries(document.modifiers)) {
            for (const [contextName, sources] of Object.entries(modifier.contexts)) {
                validateSourcesReferences(
                    sources,
                    `modifiers.${name}.contexts.${contextName}`,
                    errors
                );
            }
        }
    }
}

function validateSourcesReferences(
    sources: Array<{ $ref?: string } | Record<string, unknown>>,
    basePath: string,
    errors: ResolverError[]
): void {
    for (let i = 0; i < sources.length; i++) {
        const source = sources[i] as Record<string, unknown> | undefined;
        if (!source) continue;

        // Check for malformed references (e.g., { "path": "./file.json" } instead of { "$ref": "./file.json" })
        if (!isReference(source)) {
            const keys = Object.keys(source);
            if (keys.length === 1) {
                const key = keys[0] as string;
                const value = source[key];
                // If it looks like a file path, it's probably a typo for $ref
                if (typeof value === "string" && (value.includes("/") || value.endsWith(".json"))) {
                    errors.push({
                        path: `${basePath}[${i}]`,
                        message: ErrorMessages.RESOLVER.MALFORMED_REFERENCE(key, value),
                    });
                }
            }
            continue;
        }

        const ref = source.$ref as string;
        if (!ref.startsWith("#/")) continue;

        // Per DTCG spec 4.2.1: Sources can only reference sets, not modifiers.
        // "Only resolutionOrder may reference a modifier (#/modifiers/…).
        // Sets and modifiers MUST NOT reference another modifier."
        if (!ref.match(/^#\/sets\/[^/]+$/)) {
            errors.push({
                path: `${basePath}[${i}].$ref`,
                message: ErrorMessages.RESOLVER.INVALID_SOURCE_REFERENCE(ref),
            });
        }
    }
}

function validateReference(
    ref: string,
    path: string,
    document: ResolverDocument,
    errors: ResolverError[]
): void {
    if (!ref.startsWith("#/")) return;

    const parts = ref.slice(2).split("/");
    const [collection, name] = parts;

    if (parts.length !== 2 || !collection || !name) {
        errors.push({ path, message: ErrorMessages.RESOLVER.INVALID_REFERENCE(ref) });
        return;
    }

    if (collection === "sets") {
        if (!document.sets?.[name]) {
            errors.push({ path, message: ErrorMessages.RESOLVER.UNDEFINED_SET(name) });
        }
        return;
    }

    if (collection === "modifiers") {
        if (!document.modifiers?.[name]) {
            errors.push({ path, message: ErrorMessages.RESOLVER.UNDEFINED_MODIFIER(name) });
        }
        return;
    }

    errors.push({ path, message: ErrorMessages.RESOLVER.INVALID_REFERENCE(ref) });
}

function createEmptyDocument(): ResolverDocument {
    return { version: "2025.10", resolutionOrder: [] };
}

/**
 * Quick check without full validation.
 */
export function isResolverFormat(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return o.version === "2025.10" && Array.isArray(o.resolutionOrder);
}
