// A script that rewrites every color written as a hex string into the spec's object form, as one
// step, using the fix offered for each one.
import { commit, fix, fixesFor, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const fixes = project.doc.diagnostics
    .filter((d) => d.kind === "hex-string-color")
    .flatMap((d) => fixesFor(project, d).filter((f) => f.safe));

const done = commit(project, fix(project, fixes));
if ("project" in done) project = done.project;
else if ("refused" in done) showMessage(done.refused.reason);
