import type { Token, TokenGroup } from "../types/dtcg.js";
import type { RenderableToken } from "../types/render.js";
import type { ResolvedToken } from "../types/resolve.js";
import type { GroupRef, Reference, TokenRef, TokenType } from "../types/tokens.js";

// ============================================
// Token / reference guards (DTCG tokens)
// ============================================

export function isReference<T extends TokenType>(value: unknown): value is Reference<T> {
    return typeof value === "string" && value.startsWith("{") && value.endsWith("}");
}

export function isToken(value: unknown): value is Token {
    return typeof value === "object" && value !== null && "$value" in value;
}

export function isResolvedToken(value: unknown): value is ResolvedToken {
    return typeof value === "object" && value !== null && "$value" in value;
}

export function isGroup(value: unknown): value is TokenGroup {
    return typeof value === "object" && value !== null && !("$value" in value);
}

export function isCompositeToken(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    if (!("$value" in value)) return false;

    const tokenValue = (value as { $value: unknown }).$value;

    return (
        typeof tokenValue === "object" &&
        tokenValue !== null &&
        !Array.isArray(tokenValue) &&
        Object.keys(tokenValue).length > 0
    );
}

export function isTypographyToken(
    token: RenderableToken<TokenType>
): token is RenderableToken<"typography"> {
    return token.$type === "typography";
}

/** Checks if a key is the reserved $root token name (DTCG 2025.10 spec) */
export function isRootToken(key: string): boolean {
    return key === "$root";
}

/** Checks if an object is a token reference (has only $ref) */
export function isTokenRef(value: unknown): value is TokenRef {
    if (typeof value !== "object" || value === null) return false;
    if (!("$ref" in value) || typeof (value as Record<string, unknown>).$ref !== "string")
        return false;
    const keys = Object.keys(value);
    return keys.length === 1 && keys[0] === "$ref";
}

/** Checks if an object is a group reference (has $ref, may have overrides) */
export function isGroupRef(value: unknown): value is GroupRef {
    if (typeof value !== "object" || value === null) return false;
    return "$ref" in value && typeof (value as Record<string, unknown>).$ref === "string";
}

/** Checks if an object has a $ref property */
export function hasRef(value: unknown): value is { $ref: string } {
    return (
        typeof value === "object" &&
        value !== null &&
        "$ref" in value &&
        typeof (value as Record<string, unknown>).$ref === "string"
    );
}

// ============================================
// Resolver-document guards
// ============================================

/** Type guard for inline set in resolutionOrder. */
export function isInlineSet(
    item: unknown
): item is { type: "set"; name: string; sources: unknown[] } {
    return (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as { type: string }).type === "set"
    );
}

/** Type guard for inline modifier in resolutionOrder. */
export function isInlineModifier(item: unknown): item is {
    type: "modifier";
    name: string;
    contexts: Record<string, unknown[]>;
    default?: string;
} {
    return (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as { type: string }).type === "modifier"
    );
}
