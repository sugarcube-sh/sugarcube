import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve as resolvePath } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import { hasRef } from "../guards/token-guards.js";
import type { Token, TokenGroup } from "../types/dtcg.js";
import type { TokenTree } from "../types/tokens.js";

export type ExpandRefsError = {
    path: string;
    message: string;
    sourcePath: string;
};

export type ExpandRefsResult = {
    trees: TokenTree[];
    errors: ExpandRefsError[];
};

type ExpandContext = {
    basePath: string;
    visitedRefs: Set<string>;
    fileCache: Map<string, unknown>;
    currentPath: string[];
    sourcePath: string;
};

/**
 * Fast pre-scan to check if a tree contains any $ref properties.
 * If not, we can skip the expansion stage entirely.
 */
function containsRefs(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) return false;
    if ("$ref" in obj) return true;
    for (const value of Object.values(obj)) {
        if (containsRefs(value)) return true;
    }
    return false;
}

/**
 * Expand $ref references in token trees before flattening.
 *
 * This stage processes JSON Pointer references and normalizes them to
 * curly brace format for downstream compatibility.
 *
 * For token refs: { "$ref": "#/colors/blue" } becomes { "$value": "{colors.blue}", "$type": "color" }
 * For group refs: { "$ref": "#/button" } inlines the target group content
 */
export async function expandRefs(trees: TokenTree[]): Promise<ExpandRefsResult> {
    const results: TokenTree[] = [];
    const errors: ExpandRefsError[] = [];

    for (const tree of trees) {
        if (!containsRefs(tree.tokens)) {
            results.push(tree);
            continue;
        }

        const context: ExpandContext = {
            basePath: tree.sourcePath ? dirname(tree.sourcePath) : process.cwd(),
            visitedRefs: new Set(),
            fileCache: new Map(),
            currentPath: [],
            sourcePath: tree.sourcePath,
        };

        const { result, errors: treeErrors } = await expandRefsInGroup(
            tree.tokens,
            tree.tokens,
            context
        );

        results.push({ ...tree, tokens: result });
        errors.push(...treeErrors);
    }

    return { trees: results, errors };
}

async function expandRefsInGroup(
    node: TokenGroup,
    rootDocument: TokenGroup,
    context: ExpandContext
): Promise<{ result: TokenGroup; errors: ExpandRefsError[] }> {
    const result: TokenGroup = {};
    const errors: ExpandRefsError[] = [];

    if (node.$description) result.$description = node.$description;
    if (node.$extensions) result.$extensions = node.$extensions;
    if (node.$type) result.$type = node.$type;

    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith("$") && key !== "$root") continue;

        context.currentPath.push(key);
        const currentPathStr = context.currentPath.join(".");

        if (hasRef(value)) {
            const refResult = await resolveRef(value, rootDocument, context);

            if (refResult.error) {
                errors.push({
                    path: currentPathStr,
                    message: refResult.error,
                    sourcePath: context.sourcePath,
                });
                context.currentPath.pop();
                continue;
            }

            const resolved = refResult.value;

            if (isToken(resolved)) {
                const targetPath = jsonPointerToPath(value.$ref);

                result[key] = {
                    $value: `{${targetPath}}`,
                    ...(resolved.$description ? { $description: resolved.$description } : {}),
                    ...(resolved.$extensions ? { $extensions: resolved.$extensions } : {}),
                } as Token;
            } else {
                const { $ref, ...overrides } = value as { $ref: string; [k: string]: unknown };
                const { result: expandedGroup, errors: groupErrors } = await expandRefsInGroup(
                    resolved as TokenGroup,
                    rootDocument,
                    context
                );
                errors.push(...groupErrors);
                result[key] = { ...expandedGroup, ...overrides } as TokenGroup;
            }
        } else if (isToken(value)) {
            result[key] = value;
        } else if (typeof value === "object" && value !== null) {
            const { result: expandedGroup, errors: groupErrors } = await expandRefsInGroup(
                value as TokenGroup,
                rootDocument,
                context
            );
            errors.push(...groupErrors);
            result[key] = expandedGroup;
        }

        context.currentPath.pop();
    }

    return { result, errors };
}

type ResolveRefResult =
    | { value: Token | TokenGroup; error?: undefined }
    | { value?: undefined; error: string };

async function resolveRef(
    refObj: { $ref: string },
    rootDocument: TokenGroup,
    context: ExpandContext
): Promise<ResolveRefResult> {
    const ref = refObj.$ref;
    const currentPathStr = context.currentPath.join(".");

    const refKey = `${context.sourcePath}:${ref}`;
    if (context.visitedRefs.has(refKey)) {
        return { error: ErrorMessages.EXPAND_REFS.CIRCULAR_REFERENCE(currentPathStr, ref) };
    }

    context.visitedRefs.add(refKey);

    try {
        let result: ResolveRefResult;

        if (ref.startsWith("#/")) {
            result = resolveSameDocumentRef(ref, rootDocument, context);
        } else if (ref.includes("#/")) {
            result = await resolveExternalRef(ref, context);
        } else {
            result = await resolveExternalFileRef(ref, context);
        }

        if (!result.error && result.value && hasRef(result.value)) {
            return resolveRef(result.value as { $ref: string }, rootDocument, context);
        }

        return result;
    } finally {
        context.visitedRefs.delete(refKey);
    }
}

function resolveSameDocumentRef(
    ref: string,
    rootDocument: TokenGroup,
    context: ExpandContext
): ResolveRefResult {
    const pointer = ref.slice(1);
    const result = resolveJsonPointer(rootDocument, pointer);

    if (result.error) {
        return { error: ErrorMessages.EXPAND_REFS.INVALID_JSON_POINTER(ref, result.error) };
    }

    if (typeof result.value !== "object" || result.value === null) {
        return {
            error: ErrorMessages.EXPAND_REFS.INVALID_REF_TARGET(ref, context.currentPath.join(".")),
        };
    }

    return { value: result.value as Token | TokenGroup };
}

async function resolveExternalRef(ref: string, context: ExpandContext): Promise<ResolveRefResult> {
    const [filePart = "", fragmentPart = ""] = ref.split("#");
    const filePath = isAbsolute(filePart) ? filePart : resolvePath(context.basePath, filePart);

    let fileContent = context.fileCache.get(filePath);
    if (!fileContent) {
        const loadResult = await loadJsonFile(filePath);
        if (loadResult.error) return { error: loadResult.error };
        fileContent = loadResult.content;
        context.fileCache.set(filePath, fileContent);
    }

    const pointer = fragmentPart.startsWith("/") ? fragmentPart : `/${fragmentPart}`;
    const result = resolveJsonPointer(fileContent, pointer);

    if (result.error) {
        return { error: ErrorMessages.EXPAND_REFS.INVALID_JSON_POINTER(ref, result.error) };
    }

    if (typeof result.value !== "object" || result.value === null) {
        return {
            error: ErrorMessages.EXPAND_REFS.INVALID_REF_TARGET(ref, context.currentPath.join(".")),
        };
    }

    return { value: result.value as Token | TokenGroup };
}

async function resolveExternalFileRef(
    ref: string,
    context: ExpandContext
): Promise<ResolveRefResult> {
    const filePath = isAbsolute(ref) ? ref : resolvePath(context.basePath, ref);

    let fileContent = context.fileCache.get(filePath);
    if (!fileContent) {
        const loadResult = await loadJsonFile(filePath);
        if (loadResult.error) return { error: loadResult.error };
        fileContent = loadResult.content;
        context.fileCache.set(filePath, fileContent);
    }

    if (typeof fileContent !== "object" || fileContent === null) {
        return {
            error: ErrorMessages.EXPAND_REFS.INVALID_REF_TARGET(ref, context.currentPath.join(".")),
        };
    }

    return { value: fileContent as Token | TokenGroup };
}

type LoadResult = { content: unknown; error?: undefined } | { content?: undefined; error: string };

async function loadJsonFile(filePath: string): Promise<LoadResult> {
    try {
        const content = await readFile(filePath, "utf-8");
        return { content: JSON.parse(content) };
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { error: ErrorMessages.EXPAND_REFS.EXTERNAL_FILE_NOT_FOUND(filePath) };
        }
        return {
            error: ErrorMessages.EXPAND_REFS.EXTERNAL_FILE_ERROR(
                filePath,
                err instanceof Error ? err.message : "Unknown error"
            ),
        };
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

function jsonPointerToPath(ref: string): string {
    let pointer = ref;
    if (pointer.startsWith("#/")) pointer = pointer.slice(2);
    else if (pointer.startsWith("#")) pointer = pointer.slice(1);
    if (pointer.includes("#/")) pointer = pointer.split("#/")[1] || "";
    return pointer
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
        .join(".");
}

function isToken(value: unknown): value is Token {
    return typeof value === "object" && value !== null && "$value" in value;
}
