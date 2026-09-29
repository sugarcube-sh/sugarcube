// Adds a token to a group that already declares a type, so the new token doesn't repeat it.
import { groupOf } from "@sugarcube-sh/dtcg";
import { create, commit, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const group = groupOf(project.doc, "color");
const done = commit(project, create(project, "color", "info", { $value: "#0ea5e9" }));
if ("project" in done) project = done.project;
if (!group?.type) showMessage("This group has no type; choose one");
