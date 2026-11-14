// A bot that syncs one changed variable from Figma. It opens a pull request with just that change,
// and lists the other themes it also shows in.
import { setValue, getChangedFiles } from "@sugarcube-sh/dtcg-edit";
import { type DesignTokens } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;

const result = setValue(tokens, "color.primary.600", figmaValue, { input: { mode: "dark" } });

if (result.ops) {
    const changes = getChangedFiles(tokens, { steps: [result] });
    if (!changes.conflicts) {
        await openPullRequest(changes, {
            title: "Figma: color.primary.600 in mode: dark",
            body: `Also shows in: ${result.affectedPermutations.label}`,
        });
    }
} else if (result.question) {
    await commentOnFigma(`Needs a person to choose a file: ${result.question.files.join(", ")}`);
} else {
    await commentOnFigma(result.refusal.reason);
}
