// Deprecates a token with a message pointing at its replacement, then lists deprecated tokens still
// in use.
import { byToken, referrers } from "@sugarcube-sh/dtcg";
import { deprecate, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const done = commit(project, deprecate(project, "color.old", "Use color.new instead"));
if ("project" in done) project = done.project;

for (const view of byToken(project.doc)) {
    const reason = view.default?.deprecated;
    if (!reason) continue;
    const users = referrers(project.doc, view.path).map((r) => r.path);
    if (users.length)
        comment(`${view.path} is deprecated (${reason}) but used by ${users.join(", ")}`);
}
