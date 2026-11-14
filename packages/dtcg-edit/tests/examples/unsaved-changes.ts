// The list of unsaved changes in a token editor: what was added, removed, renamed or changed since
// the files were opened, and in which permutations. A change made in every permutation is shown
// as everywhere, and the steps a generator makes are folded under the change to its setting.
import type { Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;

for (const change of session.getChanges()) {
    const where = change.permutations.label;
    switch (change.kind) {
        case "added":
            if (!change.generated) row("added", change.path, where);
            break;
        case "removed":
            if (!change.generated) row("removed", change.path, where);
            break;
        case "changed":
            if (change.generated) break;
            row(
                change.path,
                change.properties.join(", "),
                change.before.value,
                change.after.value,
                where,
            );
            break;
        case "renamed":
            row(`${change.from} → ${change.path}`, change.properties.join(", "), where);
            break;
        case "group-added":
        case "group-removed":
            row(change.kind, change.path);
            break;
        case "group-changed":
            row(change.path, change.properties.join(", "), where);
            break;
    }
}
