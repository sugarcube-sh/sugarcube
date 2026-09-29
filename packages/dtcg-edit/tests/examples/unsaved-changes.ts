// The list of unsaved changes in a token editor: what was added, removed, renamed or changed since
// the files were opened, and in which themes. A change made in every theme is shown once, without
// naming them all, and the steps a generator makes are folded under the change to its setting.
import type { Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;

const everyTheme = session.project.doc.permutations.length;
const themes = (inputs: Record<string, string>[]) =>
    inputs.length === everyTheme ? "" : inputs.map((input) => JSON.stringify(input)).join(", ");

for (const change of session.changes()) {
    switch (change.kind) {
        case "added":
            if (!change.after.generated) row("added", change.path, themes(change.in));
            break;
        case "removed":
            if (!change.before.generated) row("removed", change.path, themes(change.in));
            break;
        case "changed":
            if (change.after.generated) break;
            row(
                change.path,
                change.properties.join(", "),
                change.before.authored?.value,
                change.after.authored?.value,
                themes(change.in),
            );
            break;
        case "renamed":
            row(`${change.from} → ${change.path}`, change.properties.join(", "), themes(change.in));
            break;
        case "group-added":
        case "group-removed":
            row(change.kind, change.path);
            break;
        case "group-changed":
            row(change.path, change.properties.join(", "), themes(change.in));
            break;
    }
}
