// Lists what changed between two versions of the tokens: added, removed and changed, and in which
// themes.
import { diff, type Document } from "@sugarcube-sh/dtcg";

declare const before: Document;
declare const after: Document;

for (const change of diff(before, after)) {
    if (change.kind === "changed")
        row(
            change.path,
            change.in.map((i) => JSON.stringify(i)).join(", "),
            change.before,
            change.after,
        );
    if (change.kind === "added") row(`+ ${change.path}`);
    if (change.kind === "removed") row(`- ${change.path}`);
}
