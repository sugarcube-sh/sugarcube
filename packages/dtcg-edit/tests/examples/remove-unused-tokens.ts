// A cleanup script that removes every token nothing references, in any theme.
import { byToken, referrers } from "@sugarcube-sh/dtcg";
import { remove, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const unused = Object.keys(byToken(project.doc)).filter(
    (path) => referrers(project.doc, path).length === 0,
);
for (const path of unused) {
    const done = commit(project, remove(project, path));
    if ("project" in done) project = done.project;
}
