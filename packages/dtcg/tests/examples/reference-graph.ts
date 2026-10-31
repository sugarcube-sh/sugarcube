// Builds a map of which tokens reference which, in each permutation, then counts the tokens nothing
// references in any permutation.
import { type DesignTokens } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;

const paths = tokens.tokenPaths();
const references = tokens.permutations.flatMap((p) => paths.flatMap((path) => p.refersTo(path)));
const unused = paths.filter((path) =>
    tokens.permutations.every((p) => p.usedBy(path).length === 0),
);
row(references.length, unused.length);
