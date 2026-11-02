// A lint rule that flags every color token without a description.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { getSpan } from "@sugarcube-sh/dtcg/editor";

declare const tokens: DesignTokens;

for (const t of tokens.getPermutation().tokens) {
    const place = t.winningDefinition;
    if (t.type === "color" && !t.description && place) {
        report(getSpan(tokens, place), `${t.path} has no description`);
    }
}
