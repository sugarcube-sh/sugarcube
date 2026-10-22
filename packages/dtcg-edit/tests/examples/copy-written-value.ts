// Gives the link colour exactly what the brand colour's file writes, a reference or a colour, by
// copying the written value across as the plain JSON it is.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { commit, setValue } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const written = tokens.permutation().token("color.brand")?.authored?.value;
if (written !== undefined) {
    const done = commit(tokens, setValue(tokens, "color.link", written));
    if (done.tokens) tokens = done.tokens;
}
