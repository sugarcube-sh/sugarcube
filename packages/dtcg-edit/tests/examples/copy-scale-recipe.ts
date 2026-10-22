// Gives the type sizes the same scale recipe as the spacing: the extension is read from one group
// and written whole to the other, as the plain JSON it is.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { commit, setExtension } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const recipe = tokens.permutation().group("space")?.extensions?.["com.example"];
if (recipe !== undefined) {
    const done = commit(tokens, setExtension(tokens, "font.size", ["com.example"], recipe));
    if (done.tokens) tokens = done.tokens;
}
