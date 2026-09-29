// Moves the semantic colors out of `colors.json` into a new `semantic.json`. Their names don't
// change.
import { addFile, move, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

let done = commit(
    project,
    addFile(project, "semantic.json", { to: { set: "base" }, after: "colors.json" }),
);
if ("project" in done) project = done.project;

for (const path of ["color.danger", "color.success", "color.warning"]) {
    done = commit(project, move(project, path, { file: "semantic.json" }));
    if ("project" in done) project = done.project;
    else if ("refused" in done) showMessage(done.refused.reason);
}
