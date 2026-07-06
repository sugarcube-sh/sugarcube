import type { ResolvedToken, ResolvedTokens } from "../../types/resolve.js";
import { isReference } from "../guards.js";
import { deriveContext } from "./permutation-context.js";

/** A resolved token is private when its set/source marked it `emit: false`. */
function isPrivateToken(node: ResolvedTokens[string]): boolean {
    return "$source" in node && node.$source?.emit === false;
}

function findTarget(
    refKey: string,
    context: string,
    tokens: ResolvedTokens,
): ResolvedToken | undefined {
    const scoped = context ? `${context}.${refKey}` : refKey;
    const node = tokens[scoped] ?? tokens[refKey];
    return node && "$value" in node ? (node as ResolvedToken) : undefined;
}

/**
 * Rewrites a value, replacing references whose target is private with the
 * target's resolved literal and leaving references to public tokens intact.
 * Walks arrays and composite objects so each leaf is decided independently.
 */
function rewriteValue(value: unknown, context: string, tokens: ResolvedTokens): unknown {
    if (typeof value === "string" && isReference(value)) {
        const refKey = value.slice(1, -1); // strip { }
        const target = findTarget(refKey, context, tokens);
        if (target && isPrivateToken(target)) {
            return target.$resolvedValue;
        }
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((v) => rewriteValue(v, context, tokens));
    }

    if (typeof value === "object" && value !== null) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = rewriteValue(v, context, tokens);
        }
        return out;
    }

    return value;
}

/**
 * Inlines references to private-set tokens and drops the private tokens.
 *
 * A token is private when its `$source.emit === false`. Private tokens resolve
 * (so public tokens may reference them) but emit no CSS variable.
 *
 * - For each public token, every reference whose target is private is replaced
 *   in `$value` with the target's resolved literal (`$resolvedValue`). Composite
 *   values are handled per leaf. References to public tokens are left untouched,
 *   so render emits `var(--…)` for them (it substitutes surviving `{ref}`s).
 * - Private tokens are removed from the output.
 *
 * At the moment, this is literal-only: a reference into a private set is flattened to its
 * resolved literal even when the chain continues to a public token. The
 * closest-public-ancestor optimisation (re-point at `var(--public)`) is deferred until needed.
 *
 * Resolution is permutation-scoped — a reference is resolved against the
 * referrer's own `perm:N` context, so inlined literals are per-permutation
 * correct.
 */
export function inlinePrivateReferences(tokens: ResolvedTokens): ResolvedTokens {
    // Fast path: with no private tokens there is nothing to drop or inline, so
    // skip the value-walk and return the input untouched.
    let hasPrivate = false;
    for (const key in tokens) {
        const node = tokens[key];
        if (node && isPrivateToken(node)) {
            hasPrivate = true;
            break;
        }
    }
    if (!hasPrivate) return tokens;

    const out: ResolvedTokens = {};

    for (const [key, node] of Object.entries(tokens)) {
        // Group metadata (no $value). These should be passed through untouched.
        if (!("$value" in node)) {
            out[key] = node;
            continue;
        }

        const token = node as ResolvedToken;

        if (isPrivateToken(token)) {
            continue;
        }

        const context = deriveContext(key, token.$path);
        const rewritten = rewriteValue(token.$value, context, tokens);

        out[key] =
            rewritten === token.$value ? token : ({ ...token, $value: rewritten } as ResolvedToken);
    }

    return out;
}
