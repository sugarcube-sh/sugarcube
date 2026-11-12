// Shows a token whose value can't be read, with what's wrong, then fixes it.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { setValue, commit } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const permutation = tokens.getPermutation();
const t = permutation.getToken("color.brand");
if (t?.invalid) {
    showBroken(t.original?.value, permutation.getDiagnostics(t.path));
    const done = commit(tokens, setValue(tokens, t.path, "#e11d48"));
    if (done.tokens) tokens = done.tokens;
}
