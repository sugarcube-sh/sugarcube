import { ErrorMessages } from "../constants/error-messages.js";
import { isCompositeToken } from "../guards/token-guards.js";
import type { FlattenError, FlattenedToken, FlattenedTokens } from "../types/flatten.js";
import type { Token, TokenGroup, TokenSource, TokenTree } from "../types/tokens.js";
import { mergeFlattenedInto } from "../utils/merge-flattened.js";

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
    source: TokenSource
): {
    tokens: FlattenedTokens;
    errors: FlattenError[];
} {
    const result: FlattenedTokens = {
        tokens: {},
        pathIndex: new Map(),
    };
    const errors: FlattenError[] = [];

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
                    sourcePath: source.sourcePath,
                },
            };
        }

        const keys = Object.keys(node).filter((key) => !key.startsWith("$"));

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
                // While the w3c spec allows for reference tokens to be flattened without $type,
                // it does not allow for composite tokens to be flattened without $type,
                // even if they contain nothing but references.
                if (isCompositeToken(value) && !value.$type && !currentType) {
                    errors.push({
                        path: childPath,
                        source,
                        message: ErrorMessages.FLATTEN.COMPOSITE_TOKEN_MISSING_TYPE(childPath),
                    });
                    continue;
                }

                const namespacedKey = createLookupKey(pathSegments);
                const originalPath = pathSegments.join(".");

                result.tokens[namespacedKey] = {
                    ...value,
                    // Only add $type if the token has an explicit $type or inherits one from parent.
                    // This allows reference tokens to be flattened without $type (per W3C spec),
                    // while ensuring non-reference tokens get proper type inheritance.
                    ...(value.$type || currentType ? { $type: value.$type || currentType } : {}),
                    $path: originalPath,
                    $source: {
                        context: source.context,
                        sourcePath: source.sourcePath,
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
export function flatten(trees: TokenTree[]): {
    tokens: FlattenedTokens;
    errors: FlattenError[];
} {
    const result: FlattenedTokens = {
        tokens: {},
        pathIndex: new Map(),
    };
    const errors: FlattenError[] = [];

    for (const tree of trees) {
        const { tokens: flattened, errors: treeErrors } = flattenTree(tree.tokens, {
            context: tree.context,
            sourcePath: tree.sourcePath,
        });

        errors.push(...treeErrors);
        mergeFlattenedInto(result, flattened, errors);
    }

    return { tokens: result, errors };
}
