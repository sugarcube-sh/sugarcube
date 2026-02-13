import { ErrorMessages } from "../constants/error-messages.js";
import type { FlattenError, FlattenedToken, FlattenedTokens } from "../types/flatten.js";

function isTokenNode(node: unknown): node is FlattenedToken {
    return typeof node === "object" && node !== null && "$value" in (node as any);
}

// Basically, "last wins" merge with conflict detection for structural mismatches
export function mergeFlattenedInto(
    base: FlattenedTokens,
    incoming: FlattenedTokens,
    errors: FlattenError[]
): void {
    for (const [key, node] of Object.entries(incoming.tokens)) {
        const existing = base.tokens[key];

        if (!isTokenNode(node)) {
            if (existing && isTokenNode(existing)) {
                const exTok = existing as FlattenedToken;
                errors.push({
                    path: exTok.$path,
                    source: exTok.$source,
                    message: ErrorMessages.FLATTEN.CONFLICT_TOKEN_VS_GROUP(exTok.$path),
                });
                continue;
            }
            base.tokens[key] = node as any;
            continue;
        }

        if (!existing) {
            base.tokens[key] = node as any;
            continue;
        }

        const existingIsToken = isTokenNode(existing);

        if (!existingIsToken) {
            errors.push({
                path: node.$path,
                source: node.$source,
                message: ErrorMessages.FLATTEN.CONFLICT_TOKEN_VS_GROUP(node.$path),
            });
            continue;
        }

        // At this point both are (should be) tokens and not groups
        const inTok = node;
        const exTok = existing as FlattenedToken;

        const incomingHasType = !!inTok.$type;
        const existingHasType = !!exTok.$type;

        if (incomingHasType && existingHasType && inTok.$type !== exTok.$type) {
            errors.push({
                path: inTok.$path,
                source: inTok.$source,
                message: ErrorMessages.FLATTEN.CONFLICT_INCOMPATIBLE_TYPES(
                    String(exTok.$type ?? "unknown"),
                    String(inTok.$type ?? "unknown"),
                    inTok.$path
                ),
            });
            continue;
        }

        base.tokens[key] = node as any;
    }

    for (const [path, k] of incoming.pathIndex) {
        base.pathIndex.set(path, k);
    }
}
