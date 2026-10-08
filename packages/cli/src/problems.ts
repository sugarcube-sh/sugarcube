import type { Reported } from "@sugarcube-sh/core";
import { join, relative } from "pathe";
import color from "picocolors";
import type { Built } from "./build.js";
import { plural } from "./plural.js";
import { rawLog } from "./prompts/log.js";

type Colors = ReturnType<typeof color.createColors>;

export interface Where {
    cwd: string;
    folder: string;
    labels: string[];
    configFile?: string;
}

interface Placed {
    problem: Reported;
    place: string;
    at?: { file: string; line: number; column: number };
}

interface Word {
    text: string;
    apart?: boolean;
    dim?: boolean;
}

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

export function problemLines(
    problems: Reported[],
    where: Where,
    { colors = color, width }: { colors?: Colors; width?: number } = {},
): string[] {
    const placed = problems.map((problem) => placedIn(problem, where)).sort(byPlace);
    const placeWidth = Math.max(...placed.map(({ place }) => place.length));
    const severityWidth = Math.max(...problems.map(({ severity }) => severity.length));
    const indent = placeWidth + 2 + severityWidth + 2;
    const tint: Record<Reported["severity"], (text: string) => string> = {
        error: colors.red,
        warning: colors.yellow,
        info: colors.cyan,
        hint: colors.cyan,
    };
    return placed.flatMap(({ problem, place }) => {
        const some = problem.permutations
            ? where.labels.filter((_, index) => problem.permutations?.includes(index))
            : [];
        const words: Word[] = [
            ...problem.message.split(" ").map((text) => ({ text })),
            ...(some.length > 0 ? [{ text: `in ${listed(some)}`, apart: true, dim: true }] : []),
            { text: problem.kind, apart: true, dim: true },
        ];
        const available = width === undefined ? undefined : width - indent;
        const padding = " ".repeat(severityWidth - problem.severity.length);
        const head = `${place.padEnd(placeWidth)}  ${tint[problem.severity](problem.severity)}${padding}  `;
        return wrapped(words, colors, available).map(
            (line, index) => (index === 0 ? head : " ".repeat(indent)) + line,
        );
    });
}

export function problemCount(problems: Reported[]): string {
    const errors = problems.filter(({ severity }) => severity === "error").length;
    const warnings = problems.filter(({ severity }) => severity === "warning").length;
    const counted = [
        ...(errors > 0 ? [plural(errors, "error")] : []),
        ...(warnings > 0 ? [plural(warnings, "warning")] : []),
    ];
    return `${counted.join(" and ")}.`;
}

function placedIn(problem: Reported, { cwd, folder, configFile }: Where): Placed {
    const { at } = problem;
    if (!at) return { problem, place: configFile ? relative(cwd, configFile) : "" };
    const file = relative(cwd, join(folder, at.file));
    const { line, column } = at.start;
    return { problem, place: `${file}:${line}:${column}`, at: { file, line, column } };
}

function byPlace({ at: a }: Placed, { at: b }: Placed): number {
    if (!a || !b) return Number(!a) - Number(!b);
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line || a.column - b.column;
}

function wrapped(words: Word[], colors: Colors, available: number | undefined): string[] {
    const lines: string[] = [];
    let line = "";
    let length = 0;
    for (const { text, apart, dim } of words) {
        let gap = length === 0 ? "" : apart ? "  " : " ";
        if (
            available !== undefined &&
            length > 0 &&
            length + gap.length + text.length > available
        ) {
            lines.push(line);
            line = "";
            length = 0;
            gap = "";
        }
        line += gap + (dim ? colors.dim(text) : text);
        length += gap.length + text.length;
    }
    return [...lines, line];
}

function listed(names: string[]): string {
    if (names.length < 3) return names.join(" and ");
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
