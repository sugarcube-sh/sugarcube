import { type Reported, type Where, problemsText } from "@sugarcube-sh/core";
import type { Built } from "./build.js";

export function whereOf({ doc, folder, configFile }: Built): Where {
    const labels = doc.permutations.map((permutation) => permutation.label);
    return { cwd: process.cwd(), folder, labels, configFile };
}

export function printProblems(
    problems: Reported[],
    where: Where,
    {
        onlyErrors = false,
        whenFailed,
        to = process.stdout,
    }: { onlyErrors?: boolean; whenFailed?: string; to?: NodeJS.WriteStream } = {},
): boolean {
    const errors = problems.filter(({ severity }) => severity === "error");
    const shown = onlyErrors ? errors : problems;
    if (shown.length === 0) return false;
    const width = to.isTTY ? to.columns : undefined;
    to.write(`\n${problemsText(shown, where, { width, ending: whenFailed })}\n`);
    return errors.length > 0;
}
