import { type Reported, type Where, problemCount, problemLines } from "@sugarcube-sh/core";
import type { Built } from "./build.js";
import { rawLog } from "./prompts/log.js";

export function whereOf({ doc, folder, configFile }: Built): Where {
    const labels = doc.permutations.map((permutation) => permutation.label);
    return { cwd: process.cwd(), folder, labels, configFile };
}

export function printProblems(
    problems: Reported[],
    where: Where,
    { onlyErrors = false, whenFailed }: { onlyErrors?: boolean; whenFailed?: string } = {},
): boolean {
    const errors = problems.filter(({ severity }) => severity === "error");
    const shown = onlyErrors ? errors : problems;
    if (shown.length === 0) return false;
    const failed = errors.length > 0;
    const width = process.stdout.isTTY ? process.stdout.columns : undefined;
    const count = problemCount(shown);
    const ending = failed && whenFailed ? `${count} ${whenFailed}` : count;
    rawLog(["", ...problemLines(shown, where, { width }), "", ending].join("\n"));
    return failed;
}
