import { ErrorMessages } from "../constants/error-messages.js";
import { isReference } from "../guards/token-guards.js";
import type { FlattenedToken, FlattenedTokens } from "../types/flatten.js";
import type { ResolutionError, ResolvedToken, ResolvedTokens } from "../types/resolve.js";
import type { NodeMetadata, TokenType, TokenValue } from "../types/tokens.js";

function resolveValue<T extends TokenType>(
    key: string,
    value: TokenValue<T>,
    tokens: FlattenedTokens,
    resolving: Set<string>
): TokenValue<T> {
    if (typeof value === "string" && isReference(value)) {
        return resolveReferenceChain(key, value, tokens, resolving) as TokenValue<T>;
    }

    // Handle arrays (for gradients, shadow arrays)
    if (Array.isArray(value)) {
        return value.map((v) =>
            resolveValue(key, v as TokenValue<T>, tokens, resolving)
        ) as TokenValue<T>;
    }

    // Handle objects (for composite types)
    if (typeof value === "object" && value !== null) {
        const resolved = Object.entries(value).reduce(
            (acc, [k, v]) =>
                Object.assign(acc, {
                    [k]: resolveValue(`${key}.${k}`, v as TokenValue<T>, tokens, resolving),
                }),
            {}
        );
        return resolved as TokenValue<T>;
    }

    return value;
}

/** Follows a reference chain to find $type (reference tokens can omit it per DTCG spec). */
function inferTypeFromReference(value: string, tokens: FlattenedTokens): TokenType | undefined {
    const refKey = value.slice(1, -1); // Remove { and }
    const namespacedKey = tokens.pathIndex.get(refKey);

    if (!namespacedKey) {
        return undefined;
    }

    const referencedToken = tokens.tokens[namespacedKey];
    if (!referencedToken || !("$value" in referencedToken)) {
        return undefined;
    }

    if (referencedToken.$type) {
        return referencedToken.$type;
    }

    // If the referenced token is also a reference, follow it recursively
    if (typeof referencedToken.$value === "string" && isReference(referencedToken.$value)) {
        return inferTypeFromReference(referencedToken.$value, tokens);
    }

    return undefined;
}

/**
 * Resolves all token references (e.g., "{color.primary}") in a flattened token structure.
 * Handles circular references, missing references, arrays, and composite types.
 */
export function resolve(tokens: FlattenedTokens): {
    resolved: ResolvedTokens;
    errors: ResolutionError[];
} {
    const resolved: ResolvedTokens = {};
    const resolving = new Set<string>();
    const errors: ResolutionError[] = [];

    for (const [key, token] of Object.entries(tokens.tokens)) {
        try {
            // Preserve metadata nodes
            if (!("$value" in token)) {
                resolved[key] = token as NodeMetadata;
                continue;
            }

            // At this point we know token is a FlattenedToken
            const flattenedToken = token as FlattenedToken<TokenType>;

            // Check if this is a reference token (has $value but no $type)
            // According to W3C spec, reference tokens don't need $type since they inherit from target.
            // However, our conversion process requires $type to generate proper CSS. This inference
            // bridges the gap by copying $type from the referenced token during resolution.
            let inferredType = flattenedToken.$type;
            if (
                !inferredType &&
                typeof flattenedToken.$value === "string" &&
                isReference(flattenedToken.$value)
            ) {
                // This is a reference token, we need to infer the type from the referenced token
                // Follow the reference chain recursively until we find a token with $type
                inferredType = inferTypeFromReference(flattenedToken.$value, tokens);
            }

            resolved[key] = {
                ...flattenedToken,
                ...(inferredType ? { $type: inferredType } : {}),
                $resolvedValue: resolveValue(
                    flattenedToken.$path,
                    flattenedToken.$value,
                    tokens,
                    resolving
                ),
            } as ResolvedToken<TokenType>;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // At this point we know token is a FlattenedToken
            const flattenedToken = token as FlattenedToken<TokenType>;
            const tokenPath = flattenedToken.$path;
            const source = flattenedToken.$source;

            let type: ResolutionError["type"];
            let message: string;

            // TODO: This is fragile. We should use the error messages directly
            // instead of checking for substrings. But TS is making this hard.
            if (errorMessage.includes("Circular reference detected")) {
                type = "circular";
                message = errorMessage;
            } else if (errorMessage.includes("Reference not found")) {
                type = "missing";
                message = errorMessage;
            } else {
                type = "type-mismatch";
                message = ErrorMessages.RESOLVE.TYPE_MISMATCH(tokenPath);
            }

            errors.push({ type, path: tokenPath, source, message });
        }
    }

    return { resolved, errors };
}

/** Resolves a chain of token references, detecting circular references. */
function resolveReferenceChain(
    key: string,
    value: string,
    tokens: FlattenedTokens,
    resolving: Set<string>
): TokenValue<TokenType> {
    const refKey = value.slice(1, -1); // Remove { and }

    // O(1) lookup using pathIndex
    const namespacedKey = tokens.pathIndex.get(refKey);

    if (!namespacedKey) {
        throw new Error(ErrorMessages.RESOLVE.REFERENCE_NOT_FOUND(refKey, key));
    }

    if (resolving.has(namespacedKey)) {
        const referencedToken = tokens.tokens[namespacedKey];
        if (!referencedToken || !("$path" in referencedToken)) {
            throw new Error(ErrorMessages.RESOLVE.REFERENCE_NOT_FOUND(refKey, key));
        }
        throw new Error(ErrorMessages.RESOLVE.CIRCULAR_REFERENCE(key, referencedToken.$path));
    }

    const referencedToken = tokens.tokens[namespacedKey];
    if (!referencedToken || !("$value" in referencedToken)) {
        throw new Error(ErrorMessages.RESOLVE.REFERENCE_NOT_FOUND(refKey, key));
    }

    resolving.add(namespacedKey);

    const resolvedValue = resolveValue(namespacedKey, referencedToken.$value, tokens, resolving);

    resolving.delete(namespacedKey);

    return resolvedValue;
}
