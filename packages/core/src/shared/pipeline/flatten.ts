import type { FlattenError, FlattenedToken, FlattenedTokens } from "../../types/flatten.js";
import type { PipelineContext } from "../../types/pipelines.js";
import type { Token, TokenGroup, TokenSource, TokenTree } from "../../types/tokens.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { WarningMessages } from "../constants/warning-messages.js";
import { isCompositeToken, isReference } from "../guards.js";
import { mergeFlattenedInto } from "./merge-flattened.js";

// Helper to check if an object looks like it was intended to be a token
// The flatten function was throwing when it found unprefixed tokens,
// so we need to check for them here. If we wait until validation,
//  it will be too late and users will get an unhelpful error.
function looksLikeUnprefixedToken(obj: unknown): boolean {
    if (typeof obj !== "object" || obj === null) return false;

    // If it has $value, it's a proper token - not unprefixed
    if ("$value" in obj) return false;

    // Only consider it an unprefixed token if it has both 'value' and 'type'
    // or if it has 'value' and looks like a direct token value
    const hasUnprefixedValue = "value" in obj;
    const hasUnprefixedType = "type" in obj;

    if (hasUnprefixedValue && hasUnprefixedType) return true;

    // If it just has 'value', check if it looks like a direct token value
    if (hasUnprefixedValue) {
        const value = (obj as { value: unknown }).value;
        return typeof value === "string" || typeof value === "number" || Array.isArray(value);
    }

    return false;
}

function flattenTree(
    tree: TokenGroup,
    source: TokenSource,
    context?: PipelineContext
): {
    tokens: FlattenedTokens;
    errors: FlattenError[];
} {
    const result: FlattenedTokens = {
        tokens: {},
        pathIndex: new Map(),
    };
    const errors: FlattenError[] = [];

    function getSourcePath(node: TokenGroup | Token): string {
        return "$sourcePath" in node && typeof node.$sourcePath === "string"
            ? node.$sourcePath
            : source.sourcePath;
    }

    function createLookupKey(path: string[] = []): string {
        const parts: string[] = [];
        if (source.context) parts.push(source.context);
        if (path.length > 0) parts.push(path.join("."));
        return parts.length > 0 ? parts.join(".") : "";
    }

    if (tree.$description || tree.$extensions) {
        result.tokens[createLookupKey()] = {
            $description: tree.$description,
            $extensions: tree.$extensions,
        };
    }

    function processNode(node: TokenGroup | Token, path: string[] = [], inheritedType?: string) {
        const currentPath = path.join(".");

        if (path.length > 0) {
            const key = createLookupKey(path);
            result.tokens[key] = {
                $description: node.$description,
                $extensions: node.$extensions,
                $path: path.join("."),
                $source: {
                    context: source.context,
                    sourcePath: getSourcePath(node),
                },
            };
        }

        // Filter out metadata properties (those starting with $), but allow $root
        // which is a reserved token name per DTCG 2025.10 spec
        const keys = Object.keys(node).filter((key) => !key.startsWith("$") || key === "$root");

        const currentType = node.$type || inheritedType;

        for (const key of keys) {
            const value = (node as TokenGroup)[key] as Token | TokenGroup;
            const pathSegments = [...path, key];
            const childPath = pathSegments.join(".");

            if (looksLikeUnprefixedToken(value)) {
                errors.push({
                    path: childPath,
                    source,
                    message: ErrorMessages.FLATTEN.MISSING_DOLLAR_PREFIX(childPath),
                });
                continue;
            }

            if (key.includes(".") || key.includes("{") || key.includes("}")) {
                errors.push({
                    path: childPath,
                    source,
                    message: ErrorMessages.FLATTEN.INVALID_TOKEN_NAME(key),
                });
                continue;
            }

            // Per DTCG 2025.10 §5.1.1, whitespace is not forbidden — names like
            // "acid green" (spec example 27) are legal. But leading/trailing
            // whitespace is virtually always a typo, and we sanitize it when
            // emitting CSS variable names; warn so the source gets fixed.
            if (key !== key.trim()) {
                context?.warn({
                    path: childPath,
                    message: WarningMessages.FLATTEN.WHITESPACE_IN_NAME(key),
                });
            }

            if ("$value" in value) {
                const childKeys = Object.keys(value).filter((k) => !k.startsWith("$"));
                if (childKeys.length > 0) {
                    errors.push({
                        path: childPath,
                        source,
                        message: ErrorMessages.FLATTEN.INVALID_TOKEN_NESTING(childPath),
                    });
                    continue;
                }

                // Check if this is a composite token missing its $type
                // Per DTCG spec section 5.2.2: if no type can be determined from the token itself,
                // parent groups, or referenced tokens, the token MUST be considered invalid.
                if (isCompositeToken(value) && !value.$type && !currentType) {
                    errors.push({
                        path: childPath,
                        source,
                        message: ErrorMessages.FLATTEN.COMPOSITE_TOKEN_MISSING_TYPE(childPath),
                    });
                    continue;
                }

                // Check if this is a simple token with a literal value missing its $type
                // Reference tokens (like { "$value": "{color.primary}" }) can omit $type
                // as the type is inferred from the referenced token.
                if (!value.$type && !currentType && !isReference(value.$value)) {
                    errors.push({
                        path: childPath,
                        source,
                        message: ErrorMessages.FLATTEN.TOKEN_MISSING_TYPE(childPath),
                    });
                    continue;
                }

                const namespacedKey = createLookupKey(pathSegments);
                const originalPath = pathSegments.join(".");

                const { $sourcePath: _stamp, ...tokenWithoutStamp } = value as Record<
                    string,
                    unknown
                >;
                result.tokens[namespacedKey] = {
                    ...tokenWithoutStamp,
                    // Only add $type if the token has an explicit $type or inherits one from parent.
                    // This allows reference tokens to be flattened without $type (per W3C spec),
                    // while ensuring non-reference tokens get proper type inheritance.
                    ...(value.$type || currentType ? { $type: value.$type || currentType } : {}),
                    $path: originalPath,
                    $source: {
                        context: source.context,
                        sourcePath: getSourcePath(value),
                    },
                    $originalPath: originalPath,
                } as FlattenedToken;

                // Add to path index for O(1) lookups
                result.pathIndex.set(originalPath, namespacedKey);
            } else {
                processNode(value as TokenGroup, pathSegments, currentType);
            }
        }
    }

    processNode(tree);

    return { tokens: result, errors };
}

/**
 * Flattens a set of token trees into a single flat structure.
 *
 * @param trees - Array of token trees to flatten
 * @returns An object containing the flattened tokens and any errors encountered
 *
 * This function:
 * 1. Combines multiple token trees into a single flat structure
 * 2. Maintains the relationship between tokens and their source files
 * 3. Creates a path index for efficient token lookups
 * 4. Validates token structure and naming
 *
 * The flattened structure uses namespaced keys that include context
 * information (when provided), making it easy to track where each token came from.
 *
 * Terminology (DTCG Resolver Module 2025.10):
 * - "context" = resolved modifier variation (e.g., "light", "dark")
 *
 * @example
 * const result = flatten([
 *   {
 *     tokens: {
 *       color: {
 *         primary: { $value: "#ff0000" }
 *       }
 *     },
 *     sourcePath: "tokens.json"
 *   }
 * ]);
 * // result.tokens = {
 * //   "color.primary": { $value: "#ff0000", $path: "color.primary", ... }
 * // }
 */
export function flatten(
    trees: TokenTree[],
    context?: PipelineContext
): {
    tokens: FlattenedTokens;
    errors: FlattenError[];
} {
    const result: FlattenedTokens = {
        tokens: {},
        pathIndex: new Map(),
    };
    const errors: FlattenError[] = [];

    for (const tree of trees) {
        const { tokens: flattened, errors: treeErrors } = flattenTree(
            tree.tokens,
            {
                context: tree.context,
                sourcePath: tree.sourcePath,
            },
            context
        );

        errors.push(...treeErrors);
        mergeFlattenedInto(result, flattened, errors);
    }

    return { tokens: result, errors };
}
