// Generates padding utility classes (`.p-sm`, `.p-md` and so on), one for each token in the `space`
// group.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { toCSSIdentifier, toCustomPropertyName } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;

for (const t of tokens.getPermutation().getGroup("space")?.tokens ?? []) {
    if (t.type !== "dimension") continue;
    const suffix = toCSSIdentifier(t.path.slice("space.".length));
    row(`.p-${suffix} { padding: var(${toCustomPropertyName(t.path)}); }`);
}
