import type { Token, TokenGroup } from "../../types/dtcg.js";
import type { TokenTree } from "../../types/tokens.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { hasRef } from "../guards.js";
import { expandGenerators } from "./expand-generators.js";
import { mergeGroups } from "./merge-groups.js";

export type ExpandError = {
    path: string;
    message: string;
    sourcePath: string;
};

export type ExpandResult = {
    trees: TokenTree[];
    errors: ExpandError[];
};

type GroupResult = {
    result: TokenGroup;
    errors: ExpandError[];
};

type EntryResult = { value: Token | TokenGroup; errors?: ExpandError[] } | { error: ExpandError };

type ResolveRefResult =
    | { value: Token | TokenGroup; error?: undefined }
    | { value?: undefined; error: string };

type PointerResult = { value: unknown; error?: undefined } | { value?: undefined; error: string };

type SortResult = { order: string[]; cycle?: undefined } | { order?: undefined; cycle: string[] };

type ExpandSingleResult =
    | { result: TokenGroup; error?: undefined }
    | { result?: undefined; error: ExpandError };

type ExpandContext = {
    visitedRefs: Set<string>;
    currentPath: string[];
    sourcePath: string;
};

function isToken(value: unknown): value is Token {
    return typeof value === "object" && value !== null && "$value" in value;
}

function isUserKey(key: string): boolean {
    return !key.startsWith("$") || key === "$root";
}

function curlyBraceToPath(ref: string): string {
    return ref.startsWith("{") && ref.endsWith("}") ? ref.slice(1, -1) : ref;
}

function jsonPointerToPath(ref: string): string {
    let pointer = ref;
    if (pointer.startsWith("#/")) pointer = pointer.slice(2);
    else if (pointer.startsWith("#")) pointer = pointer.slice(1);
    return pointer
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
        .join(".");
}

// We pre-scan to check if a tree contains any $ref or $extends properties.
// That way, if it doesn't, we can skip the expansion stage entirely
// and save some time.
function containsRefsOrExtends(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) return false;
    if ("$ref" in obj || "$extends" in obj) return true;
    for (const value of Object.values(obj)) {
        if (containsRefsOrExtends(value)) return true;
    }
    return false;
}

/**
 * Expand $ref, $extends, and sugarcube generator extensions in token trees
 * before flattening.
 *
 * Three passes:
 * 1. $ref: convert JSON Pointer references to curly brace format
 * 2. $extends: resolve group inheritance via deep merge
 * 3. generators: expand sh.sugarcube.scale (and future palette) recipes
 *
 * For token refs: { "$ref": "#/colors/blue" } becomes { "$value": "{colors.blue}" }
 * For group refs: { "$ref": "#/button" } inlines the target group content
 * For extends: { "$extends": "{button}" } inherits from the button group
 * For generators: a group's sh.sugarcube.scale recipe expands to child tokens
 */
export function expand(trees: TokenTree[]): ExpandResult {
    const results: TokenTree[] = [];
    const errors: ExpandError[] = [];

    for (const tree of trees) {
        if (!containsRefsOrExtends(tree.tokens)) {
            results.push(tree);
            continue;
        }

        const context: ExpandContext = {
            visitedRefs: new Set(),
            currentPath: [],
            sourcePath: tree.sourcePath,
        };

        // First pass: expand $ref references
        const { result: refsExpanded, errors: refErrors } = expandRefsInGroup(
            tree.tokens,
            tree.tokens,
            context
        );
        errors.push(...refErrors);

        // Second pass: expand $extends inheritance
        const { result: extendsExpanded, errors: extendsErrors } = expandExtendsInTree(
            refsExpanded,
            context.sourcePath
        );
        errors.push(...extendsErrors);

        results.push({ ...tree, tokens: extendsExpanded });
    }

    // Third pass: expand scale recipes into the tokens they describe.
    // Runs after refs/extends settle, so a recipe inherited from another
    // group resolves before it generates anything.
    // Runs across the result trees once refs/extends have settled, so a scale
    // recipe inherited from another group resolves before scale expansion.
    const { trees: withGenerators, errors: generatorErrors } = expandGenerators(results);
    errors.push(...generatorErrors);

    return { trees: withGenerators, errors };
}

// ============================================
// Pass 1: $ref expansion
// ============================================

function copyGroupProperties(node: TokenGroup): TokenGroup {
    const result: TokenGroup = {};
    if (node.$description) result.$description = node.$description;
    if (node.$extensions) result.$extensions = node.$extensions;
    if (node.$type) result.$type = node.$type;
    if (node.$extends) result.$extends = node.$extends;
    return result;
}

function expandTokenRef(value: { $ref: string }, resolved: Token): Token {
    return {
        $value: `{${jsonPointerToPath(value.$ref)}}`,
        ...(resolved.$description ? { $description: resolved.$description } : {}),
        ...(resolved.$extensions ? { $extensions: resolved.$extensions } : {}),
    } as Token;
}

function expandGroupRef(
    value: { $ref: string; [k: string]: unknown },
    resolved: TokenGroup,
    rootDocument: TokenGroup,
    context: ExpandContext
): GroupResult {
    const { $ref, ...overrides } = value;
    const { result: expandedGroup, errors } = expandRefsInGroup(resolved, rootDocument, context);
    return { result: { ...expandedGroup, ...overrides } as TokenGroup, errors };
}

function expandRefEntry(
    value: { $ref: string; [k: string]: unknown },
    rootDocument: TokenGroup,
    context: ExpandContext
): EntryResult {
    const refResult = resolveRef(value, rootDocument, context);

    if (refResult.error) {
        return {
            error: {
                path: context.currentPath.join("."),
                message: refResult.error,
                sourcePath: context.sourcePath,
            },
        };
    }

    if (isToken(refResult.value)) {
        return { value: expandTokenRef(value, refResult.value) };
    }

    const expanded = expandGroupRef(value, refResult.value as TokenGroup, rootDocument, context);
    return { value: expanded.result, errors: expanded.errors };
}

function expandEntry(
    value: unknown,
    rootDocument: TokenGroup,
    context: ExpandContext
): EntryResult {
    if (hasRef(value)) {
        return expandRefEntry(value, rootDocument, context);
    }

    if (isToken(value)) {
        return { value };
    }

    // Must be a group — recurse
    const { result, errors } = expandRefsInGroup(value as TokenGroup, rootDocument, context);
    return { value: result, errors };
}

function expandRefsInGroup(
    node: TokenGroup,
    rootDocument: TokenGroup,
    context: ExpandContext
): GroupResult {
    const result = copyGroupProperties(node);
    const errors: ExpandError[] = [];

    for (const [key, value] of Object.entries(node)) {
        if (!isUserKey(key)) continue;

        context.currentPath.push(key);
        const entry = expandEntry(value, rootDocument, context);
        context.currentPath.pop();

        if ("error" in entry) {
            errors.push(entry.error);
            continue;
        }

        result[key] = entry.value;
        if (entry.errors) errors.push(...entry.errors);
    }

    return { result, errors };
}

// ============================================
// $ref resolution
// ============================================

function resolveRef(
    refObj: { $ref: string },
    rootDocument: TokenGroup,
    context: ExpandContext
): ResolveRefResult {
    const ref = refObj.$ref;
    const currentPathStr = context.currentPath.join(".");

    if (!ref.startsWith("#/")) {
        return {
            error: ErrorMessages.EXPAND_TREE.INVALID_JSON_POINTER(
                ref,
                "only same-document references (#/...) are supported in token files"
            ),
        };
    }

    const refKey = `${context.sourcePath}:${ref}`;
    if (context.visitedRefs.has(refKey)) {
        return { error: ErrorMessages.EXPAND_TREE.CIRCULAR_REFERENCE(currentPathStr, ref) };
    }

    context.visitedRefs.add(refKey);
    const result = resolveRefPointer(ref, currentPathStr, rootDocument, context);
    context.visitedRefs.delete(refKey);
    return result;
}

function resolveRefPointer(
    ref: string,
    currentPathStr: string,
    rootDocument: TokenGroup,
    context: ExpandContext
): ResolveRefResult {
    const pointer = ref.slice(1);
    const pointerResult = resolveJsonPointer(rootDocument, pointer);

    if (pointerResult.error) {
        return {
            error: ErrorMessages.EXPAND_TREE.INVALID_JSON_POINTER(ref, pointerResult.error),
        };
    }

    if (typeof pointerResult.value !== "object" || pointerResult.value === null) {
        return {
            error: ErrorMessages.EXPAND_TREE.INVALID_REF_TARGET(ref, currentPathStr),
        };
    }

    const resolved = pointerResult.value as Token | TokenGroup;

    if (hasRef(resolved)) {
        return resolveRef(resolved as { $ref: string }, rootDocument, context);
    }

    return { value: resolved };
}

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

// ============================================
// Pass 2: $extends expansion (DTCG 2025.10 spec 6.4)
// ============================================

/**
 * Expand $extends inheritance in a token tree.
 * Uses topological sort to process base groups before derived groups.
 */
function expandExtendsInTree(tokens: TokenGroup, sourcePath: string): GroupResult {
    const errors: ExpandError[] = [];

    const extendsMap = new Map<string, string>();
    collectExtendsDependencies(tokens, [], extendsMap);

    if (extendsMap.size === 0) {
        return { result: tokens, errors };
    }

    const sortResult = topologicalSort(extendsMap);
    if (sortResult.cycle) {
        errors.push({
            path: sortResult.cycle[0] || "",
            message: ErrorMessages.EXPAND_TREE.CIRCULAR_EXTENDS(
                sortResult.cycle[0] || "",
                sortResult.cycle
            ),
            sourcePath,
        });
        return { result: tokens, errors };
    }

    let result = tokens;
    for (const path of sortResult.order) {
        const extendsTarget = extendsMap.get(path);
        if (!extendsTarget) continue;

        const expandResult = expandSingleExtends(result, path, extendsTarget, sourcePath);
        if (expandResult.error) {
            errors.push(expandResult.error);
        } else {
            result = expandResult.result;
        }
    }

    return { result, errors };
}

function collectExtendsDependencies(
    node: TokenGroup,
    currentPath: string[],
    extendsMap: Map<string, string>
): void {
    if (node.$extends && typeof node.$extends === "string") {
        extendsMap.set(currentPath.join("."), curlyBraceToPath(node.$extends));
    }

    for (const [key, value] of Object.entries(node)) {
        if (!isUserKey(key)) continue;
        if (typeof value === "object" && value !== null && !isToken(value)) {
            collectExtendsDependencies(value as TokenGroup, [...currentPath, key], extendsMap);
        }
    }
}

function topologicalSort(dependencies: Map<string, string>): SortResult {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    function visit(path: string, chain: string[]): string[] | null {
        if (visiting.has(path)) return [...chain, path];
        if (visited.has(path)) return null;

        visiting.add(path);
        chain.push(path);

        const dep = dependencies.get(path);
        if (dep && dependencies.has(dep)) {
            const cycle = visit(dep, chain);
            if (cycle) return cycle;
        }

        visiting.delete(path);
        visited.add(path);
        order.push(path);
        return null;
    }

    for (const path of dependencies.keys()) {
        const cycle = visit(path, []);
        if (cycle) return { cycle };
    }

    return { order };
}

function expandSingleExtends(
    root: TokenGroup,
    path: string,
    targetPath: string,
    sourcePath: string
): ExpandSingleResult {
    const localGroup = getGroupAtPath(root, path);
    if (!localGroup || isToken(localGroup)) {
        return {
            error: {
                path,
                message: `Internal error: group at "${path}" not found`,
                sourcePath,
            },
        };
    }

    const baseGroup = getGroupAtPath(root, targetPath);
    if (!baseGroup) {
        return {
            error: {
                path,
                message: ErrorMessages.EXPAND_TREE.EXTENDS_TARGET_NOT_FOUND(path, targetPath),
                sourcePath,
            },
        };
    }

    if (isToken(baseGroup)) {
        return {
            error: {
                path,
                message: ErrorMessages.EXPAND_TREE.INVALID_EXTENDS_TARGET(path, targetPath),
                sourcePath,
            },
        };
    }

    const merged = mergeGroups(baseGroup, localGroup);
    return { result: setGroupAtPath(root, path, merged) };
}

// ============================================
// Tree path utilities
// ============================================

function getGroupAtPath(root: TokenGroup, path: string): TokenGroup | Token | undefined {
    if (path === "") return root;

    const segments = path.split(".");
    let current: unknown = root;

    for (const segment of segments) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[segment];
    }

    return current as TokenGroup | Token | undefined;
}

function setGroupAtPath(root: TokenGroup, path: string, value: TokenGroup): TokenGroup {
    if (path === "") return value;

    const segments = path.split(".");
    const result = { ...root };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        if (segment === undefined) continue;
        current[segment] = { ...(current[segment] as Record<string, unknown>) };
        current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = segments[segments.length - 1];
    if (lastSegment !== undefined) {
        current[lastSegment] = value;
    }

    return result;
}
