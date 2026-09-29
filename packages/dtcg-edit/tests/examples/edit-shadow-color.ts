// Changes only the color of a shadow, leaving the rest of it as written.
import { setValue, type Project } from "@sugarcube-sh/dtcg-edit";

declare const project: Project;

setValue(project, "shadow.card", "#00000055", { part: ["color"] });
