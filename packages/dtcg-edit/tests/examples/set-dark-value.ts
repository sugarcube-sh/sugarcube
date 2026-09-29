// Setting a color for the dark theme only. If more than one file could hold it, the person is asked
// which.
import { setValue, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;
const dark = { theme: "dark" };

let done = commit(project, setValue(project, "color.danger", "#fca5a5", { context: dark }));

if ("decision" in done && done.decision.kind === "placement") {
    const file = await askPerson(done.decision.candidates);
    done = commit(
        project,
        setValue(project, "color.danger", "#fca5a5", { context: dark, place: file }),
    );
}
if ("project" in done) project = done.project;
else if ("refused" in done) showMessage(done.refused.reason);
else if ("conflicts" in done) showConflicts(done.conflicts);
