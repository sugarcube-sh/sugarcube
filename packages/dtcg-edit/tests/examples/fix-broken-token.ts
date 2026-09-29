// Shows a token whose value can't be read, with what's wrong, then fixes it.
import { diagnosticsOf, token } from "@sugarcube-sh/dtcg";
import { setValue, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const t = token(project.doc, "color.brand");
if (t?.invalid) {
    showBroken(t.authored?.value, diagnosticsOf(project.doc, t.path));
    const done = commit(project, setValue(project, t.path, "#e11d48"));
    if ("project" in done) project = done.project;
}
