// Removes a whole group, after first showing which references that would break.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { remove, commit } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const result = remove(tokens, "color.legacy");
if (result.ops && result.pathsWithBrokenReferences?.length) {
    showMessage(`Removing color.legacy breaks: ${result.pathsWithBrokenReferences.join(", ")}`);
}
const done = commit(tokens, result);
if (done.tokens) tokens = done.tokens;
