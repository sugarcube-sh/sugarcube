// Finds colors with the same value under different names, and suggests pointing one at the other.
import { isEquivalentValue, type DesignTokens, type Token } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;

const colors = tokens
    .getPermutation()
    .tokens.filter(
        (t): t is Extract<Token, { type: "color" }> => t.type === "color" && !t.getReferenceAt(),
    );

for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
        const a = colors[i];
        const b = colors[j];
        if (
            a?.resolvedValue &&
            b?.resolvedValue &&
            isEquivalentValue("color", a.resolvedValue, b.resolvedValue)
        ) {
            comment(`${a.path} and ${b.path} are the same colour; alias one to the other`);
        }
    }
}
