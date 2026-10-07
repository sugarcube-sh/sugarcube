// Applies the safe fixes by itself, and asks a person before applying each of the rest.
import { errors } from "@sugarcube-sh/dtcg";
import { commit, fix, fixesFor, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;
declare function confirm(question: string): Promise<boolean>;

for (const d of errors(project.doc)) {
    for (const offered of fixesFor(project, d)) {
        if (!offered.safe && !(await confirm(`${d.message}: ${offered.title}?`))) continue;
        const done = commit(project, fix(project, [offered]));
        if ("project" in done) project = done.project;
    }
}
