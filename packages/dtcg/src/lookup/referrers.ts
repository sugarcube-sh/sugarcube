import type { Document, Input, Permutation, Related, Token } from "../index.js";
import { type OnDocument, type OnPermutation, indexBy, related } from "./related.js";

const referredBy = indexBy(({ from, to }) => [to, from]);

export interface ReferrersOptions {
    /**
     * Include tokens that refer to it through others, however indirectly. Safe with loops.
     * @default false
     */
    transitive?: boolean;
}

/**
 * The tokens that refer to this one, or to any of several, in file order, in a permutation you
 * already hold. A pointer into part of a token's value counts as referring to that token. The
 * tokens asked about are never among them, even in a loop. For the tokens it refers to, use
 * {@link dependencies}.
 *
 * @example
 * referrers(permutation, "color.brand")                        // color.danger, border.focus
 * referrers(permutation, "palette.red", { transitive: true })   // everything a change would reach
 * referrers(permutation, ["color.brand", "color.surface"])    // what refers to either
 */
export function referrers(
    permutation: Permutation,
    path: string | string[],
    options?: ReferrersOptions,
): Token[];
/**
 * The tokens that refer to this one, or to any of several, across a document: each path once,
 * with the permutations it refers in, in the order they are first met.
 * @param input Only this permutation. Left out: every permutation.
 *
 * @example
 * referrers(doc, "palette.red.600")                     // everywhere
 * referrers(doc, "palette.red.600", { theme: "dark" })  // in dark only
 */
export function referrers(
    doc: Document,
    path: string | string[],
    input?: Input,
    options?: ReferrersOptions,
): Related[];
export function referrers(
    ...args: OnPermutation<ReferrersOptions> | OnDocument<ReferrersOptions>
): Token[] | Related[] {
    return related(referredBy, args);
}
