// A bot that syncs one changed variable from Figma. It opens a pull request with just that change,
// and lists the other themes it also shows in.
import { setValue, apply, changedFiles, type Project } from "@sugarcube-sh/dtcg-edit";
import { permutation } from "@sugarcube-sh/dtcg";

declare const project: Project;

const result = setValue(project, "color.primary.600", figmaValue, { context: { theme: "dark" } });

if ("ops" in result) {
    const next = apply(project, result.ops);
    if (!("conflicts" in next)) {
        const also = result.alsoAffects.map(
            (input) => permutation(project.doc, input)?.label ?? JSON.stringify(input),
        );
        await openPullRequest(changedFiles(project, next), {
            title: "Figma: color.primary.600 in dark",
            body: `Also shows in: ${also.join(", ") || "nothing else"}`,
        });
    }
} else if ("decision" in result) {
    await commentOnFigma(`Needs a person: ${result.decision.kind}`);
} else {
    await commentOnFigma(result.refused.reason);
}
