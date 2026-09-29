// Changes a spacing scale's ratio. The steps are remade from the new ratio when the tokens are read
// again.
import { setExtension, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const done = commit(
    project,
    setExtension(project, "space", ["sh.sugarcube", "scale", "ratio"], 1.333),
);
if ("project" in done) project = done.project;
