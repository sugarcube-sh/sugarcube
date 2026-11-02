// Lists what changed between two versions of the tokens: added, removed and changed, what each
// file wrote before and after, and in which permutations.
import { type DesignTokens } from "@sugarcube-sh/dtcg";

declare const before: DesignTokens;
declare const after: DesignTokens;

for (const change of after.getChangesSince(before)) {
    const where = change.permutations.label;
    if (change.kind === "changed") row(change.path, where, change.before.value, change.after.value);
    if (change.kind === "added") row(`+ ${change.path}`, where);
    if (change.kind === "removed") row(`- ${change.path}`, where);
}
