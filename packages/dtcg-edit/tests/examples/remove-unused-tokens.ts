// A cleanup script that removes every token nothing references, in any permutation, as one step: if
// one can't be removed, nothing is.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { combine, commit, remove } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const unused = tokens.getTokenPaths().filter((path) => tokens.getReferencesTo(path).length === 0);
const done = commit(
    tokens,
    combine(
        tokens,
        unused.map((path) => (current) => remove(current, path)),
    ),
);
if (done.tokens) tokens = done.tokens;
else if (done.refusal) showMessage(done.refusal.reason);
