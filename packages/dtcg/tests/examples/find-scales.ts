// Finds the scales among the design tokens: groups whose steps are made by a generator, and groups
// written out by hand whose tokens are all sizes.
import { type DesignTokens } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;

for (const group of tokens.getPermutation().groups) {
    if (group.extensions?.["com.example.scale"]) {
        row(group.path, "made by a generator");
        continue;
    }
    const steps = group.childTokens;
    if (steps.length > 1 && steps.every((t) => t.type === "dimension" && !t.generated)) {
        row(group.path, "written by hand");
    }
}
