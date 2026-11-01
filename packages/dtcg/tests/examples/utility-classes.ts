// Generates padding utility classes (`.p-sm`, `.p-md` and so on), one for each token in the `space`
// group.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { cssIdentifier, cssCustomProperty } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;

for (const t of tokens.permutation().group("space")?.tokens ?? []) {
    if (t.type !== "dimension") continue;
    const suffix = cssIdentifier(t.path.slice("space.".length));
    row(`.p-${suffix} { padding: var(${cssCustomProperty(t.path)}); }`);
}
