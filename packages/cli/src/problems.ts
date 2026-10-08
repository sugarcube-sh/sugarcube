import { problemCount, problemLines } from "@sugarcube-sh/core";
import type { Built } from "./build.js";
import { rawLog } from "./prompts/log.js";

export function printProblems(
    { doc, folder, configFile, diagnostics }: Built,
    { onlyErrors = false, whenFailed }: { onlyErrors?: boolean; whenFailed?: string } = {},
): boolean {
    const errors = diagnostics.filter(({ severity }) => severity === "error");
    const shown = onlyErrors ? errors : diagnostics;
    if (shown.length === 0) return false;
    const failed = errors.length > 0;
    const labels = doc.permutations.map((permutation) => permutation.label);
    const where = { cwd: process.cwd(), folder, labels, configFile };
    const width = process.stdout.isTTY ? process.stdout.columns : undefined;
    const count = problemCount(shown);
    const ending = failed && whenFailed ? `${count} ${whenFailed}` : count;
    rawLog(["", ...problemLines(shown, where, { width }), "", ending].join("\n"));
    return failed;
}
