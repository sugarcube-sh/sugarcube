// A token's detail page. It shows the value as written, then each theme that overrides it, with the
// file each value comes from.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";

declare const tokens: DesignTokens;
const path = "color.danger";

for (const { span, json, winningPermutations } of tokens.getDefinitions(path)) {
    row(winningPermutations.label, isJsonObject(json) ? json.$value : undefined, span.file);
}
