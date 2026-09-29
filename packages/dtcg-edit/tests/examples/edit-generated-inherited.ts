// Editing a token made by a generator, and a token inherited from another group. Each asks a question
// first: turn the step into an ordinary token, or override it here rather than in the original.
import { setValue, detach, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const a = commit(project, setValue(project, "space.md", { value: 18, unit: "px" }));
if ("decision" in a && a.decision.kind === "generated") {
    const done = commit(project, detach(project, "space.md"));
    if ("project" in done) project = done.project;
}

const b = commit(project, setValue(project, "primary.padding", "{space.lg}"));
if ("decision" in b && b.decision.kind === "inherited") {
    const done = commit(
        project,
        setValue(project, "primary.padding", "{space.lg}", { inherited: "here" }),
    );
    if ("project" in done) project = done.project;
}
