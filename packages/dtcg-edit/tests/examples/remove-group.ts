// Removes a whole group, after first showing which references that would break.
import { remove, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const result = remove(project, "color.legacy");
if ("ops" in result && result.broken?.length) {
    showMessage(`Removing color.legacy breaks: ${result.broken.join(", ")}`);
}
const done = commit(project, result);
if ("project" in done) project = done.project;
