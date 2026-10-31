// A cleanup script that removes every token nothing references, in any permutation, as one step: if
// one can't be removed, nothing is.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { combine, commit, remove } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const unused = tokens
    .tokenPaths()
    .filter((path) => tokens.permutations.every((p) => p.usedBy(path).length === 0));
const done = commit(
    tokens,
    combine(
        tokens,
        unused.map((path) => (current) => remove(current, path)),
    ),
);
if (done.tokens) tokens = done.tokens;
else if (done.refused) showMessage(done.refused.reason);
