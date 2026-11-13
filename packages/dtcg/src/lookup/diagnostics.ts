import type { DesignTokens } from "../model/design-tokens.js";
import type { Diagnostic } from "../model/diagnostic.js";
import type { Permutation } from "../model/permutation.js";
import type { Token } from "../model/token.js";
import { getSpan } from "./editor.js";

export function createDiagnosticFilter(
    tokens: DesignTokens,
    path: string,
    permutations: readonly Permutation[],
): (diagnostic: Diagnostic) => boolean {
    const tokensByPermutation = permutations.flatMap((each) => {
        const token = each.getToken(path);
        return token ? [{ permutation: each, token }] : [];
    });
    return (diagnostic) =>
        mentionsPath(diagnostic, path) ||
        tokensByPermutation.some(({ permutation, token }) =>
            isInsideTokenValue(tokens, diagnostic, permutation, token),
        );
}

function isInsideTokenValue(
    tokens: DesignTokens,
    { span, path }: Diagnostic,
    permutation: Permutation,
    token: Token,
): boolean {
    if (span === undefined || path === undefined || path === token.path) return false;
    const from = getSpan(tokens, token.winningDefinition);
    const other = permutation.getToken(path);
    return (
        other !== undefined &&
        getSpan(tokens, other.winningDefinition) === from &&
        span.file === from.file &&
        from.offset <= span.offset &&
        span.offset + span.length <= from.offset + from.length
    );
}

function mentionsPath(diagnostic: Diagnostic, path: string): boolean {
    if (diagnostic.path === path) return true;
    if (diagnostic.kind === "missing-reference") return diagnostic.detail.from.includes(path);
    if (diagnostic.kind === "circular-reference") return diagnostic.detail.chain.includes(path);
    return false;
}
