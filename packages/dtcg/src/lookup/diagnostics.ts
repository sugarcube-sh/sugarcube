import type { DesignTokens, Diagnostic, Permutation, Token } from "../model.js";
import { getSpan } from "./editor.js";

export function concerning(
    tokens: DesignTokens,
    path: string,
    permutations: readonly Permutation[],
): (found: Diagnostic) => boolean {
    const taking = permutations.flatMap((each) => {
        const token = each.getToken(path);
        return token ? [{ permutation: each, token }] : [];
    });
    return (found) =>
        isAbout(found, path) ||
        taking.some(({ permutation, token }) => isInValueFrom(tokens, found, permutation, token));
}

function isInValueFrom(
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

function isAbout(found: Diagnostic, path: string): boolean {
    if (found.path === path) return true;
    if (found.kind === "missing-reference") return found.detail.from.includes(path);
    if (found.kind === "circular-reference") return found.detail.chain.includes(path);
    return false;
}
