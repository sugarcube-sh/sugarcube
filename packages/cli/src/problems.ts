import { type AnyDiagnostic, type ProblemContext, formatProblems } from "@sugarcube-sh/core";
import type { BuildResult } from "./build.js";

export function getProblemContext({ entryFile, configFile, tokens }: BuildResult): ProblemContext {
    return { cwd: process.cwd(), entryFile, configFile, tokens };
}

export function printProblems(
    problems: AnyDiagnostic[],
    context: ProblemContext,
    {
        onlyErrors = false,
        failureText,
        stream = process.stdout,
    }: { onlyErrors?: boolean; failureText?: string; stream?: NodeJS.WriteStream } = {},
): boolean {
    const errors = problems.filter(({ severity }) => severity === "error");
    const shown = onlyErrors ? errors : problems;
    if (shown.length === 0) return false;
    const width = stream.isTTY ? stream.columns : undefined;
    stream.write(`\n${formatProblems(shown, context, { width, failureText })}\n`);
    return errors.length > 0;
}
