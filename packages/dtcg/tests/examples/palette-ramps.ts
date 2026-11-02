// A palette page. Groups of plain colors show as swatch ramps, and colors that point at a palette
// show underneath as roles, each with the swatch it points at.
import { type ColorValue, type DesignTokens } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;
declare function swatch(color: ColorValue | undefined): string;

const permutation = tokens.getPermutation();

for (const group of permutation.groups) {
    const colors = group.childTokens.filter((t) => t.type === "color");
    const steps = colors.filter((t) => !t.getReferenceAt());
    if (steps.length > 0) row(group.path, ...steps.map((step) => swatch(step.resolved)));
}

for (const t of permutation.tokens) {
    if (t.type !== "color") continue;
    const target = t.getReferenceAt();
    if (target) row(t.path, target.pointsToPath ?? "", swatch(t.resolved));
}
