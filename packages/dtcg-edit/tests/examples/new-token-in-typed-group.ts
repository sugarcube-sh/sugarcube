// Adds a token to a group that already declares a type, so the new token doesn't repeat it.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { create, commit } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const colors = tokens.getPermutation().getGroup("color");
if (!colors?.type) {
    showMessage("This group has no type; choose one");
} else {
    const done = commit(tokens, create(tokens, "color.info", { $value: "#0ea5e9" }));
    if (done.tokens) tokens = done.tokens;
}
