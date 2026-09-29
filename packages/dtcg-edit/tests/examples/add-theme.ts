// Adds a theme built on dark, then gives it one color of its own.
import { addContext, setValue, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

let done = commit(
    project,
    addContext(project, "theme", "dim", { file: "dim.json", basedOn: "dark" }),
);
if (!("project" in done)) throw new Error("could not add the dim theme");
project = done.project;

done = commit(
    project,
    setValue(project, "color.surface", "#2a2a2e", { context: { theme: "dim" } }),
);
if ("project" in done) project = done.project;
