import { type DesignTokens, type Span, getFilePath, getSourceLine } from "@sugarcube-sh/dtcg";
import { relative } from "pathe";
import color from "picocolors";
import type { AnyDiagnostic } from "../types/diagnostics.js";
import { pluralize } from "./plural.js";

export interface ProblemContext {
    cwd: string;
    entryFile: string;
    configFile?: string;
    tokens?: DesignTokens;
}

interface LocatedProblem {
    problem: AnyDiagnostic;
    location?: { file: string; line: number; column: number };
}

export interface ProblemBlock {
    severity: AnyDiagnostic["severity"];
    text: string;
}

interface PrintOptions {
    colors?: boolean;
    width?: number;
}

const LINE_WIDTH = 100;

export function formatProblems(
    problems: readonly AnyDiagnostic[],
    where: ProblemContext,
    { failureText, ...look }: PrintOptions & { failureText?: string } = {},
): string {
    if (problems.length === 0) return "";
    const count = formatProblemCount(problems);
    const failed = problems.some(({ severity }) => severity === "error");
    const last = failed && failureText ? `${count} ${failureText}` : count;
    const blocks = formatProblemBlocks(problems, where, look).map(({ text }) => text);
    return [...blocks, last].join("\n\n");
}

export function formatProblemBlocks(
    problems: readonly AnyDiagnostic[],
    where: ProblemContext,
    { colors: colored, width }: PrintOptions = {},
): ProblemBlock[] {
    const colors = colored === undefined ? color : color.createColors(colored);
    const files = where.tokens?.toMemory().files;
    const colorBySeverity: Record<AnyDiagnostic["severity"], (text: string) => string> = {
        error: colors.red,
        warning: colors.yellow,
        info: colors.cyan,
        hint: colors.cyan,
    };
    const formatLocation = (span: Span | undefined) => {
        if (span) {
            const { file, line, column } = getLocation(span, where);
            return colors.cyan(file) + colors.yellow(`:${line}:${column}`);
        }
        const { cwd, configFile } = where;
        return configFile ? colors.cyan(relative(cwd, configFile)) : "";
    };
    return problems
        .map((problem) => ({
            problem,
            ...(problem.span && { location: getLocation(problem.span, where) }),
        }))
        .sort(compareByLocation)
        .map(({ problem }: LocatedProblem) => {
            const { span, severity, kind, help } = problem;
            const place = formatLocation(span);
            const heading = colorBySeverity[severity](severity) + colors.gray(`[${kind}]`);
            const permutations = getPermutationsLabel(problem, where.tokens);
            const fileText = span && files?.[span.file];
            const frame =
                span && fileText !== undefined
                    ? formatSourceLines(span, fileText, help, colorBySeverity[severity], width)
                    : formatHelp(help);
            const related = (problem.relatedInformation ?? []).map(
                ({ message, span: at }) => `  ${formatLocation(at)}  ${message}`,
            );
            const text = [
                place ? `${place}  ${heading}` : heading,
                `  ${problem.message}${permutations ? ` in ${permutations}` : ""}`,
                ...frame,
                ...related,
            ].join("\n");
            return { severity, text };
        });
}

export function formatProblemCount(problems: readonly AnyDiagnostic[]): string {
    const errors = problems.filter(({ severity }) => severity === "error").length;
    const warnings = problems.filter(({ severity }) => severity === "warning").length;
    const counted = [
        ...(errors > 0 ? [pluralize(errors, "error")] : []),
        ...(warnings > 0 ? [pluralize(warnings, "warning")] : []),
    ];
    return `${counted.join(" and ")}.`;
}

function getPermutationsLabel(
    problem: AnyDiagnostic,
    tokens: DesignTokens | undefined,
): string | undefined {
    const { permutations, span } = problem;
    if (!permutations || permutations.length === 0) return undefined;
    if (span && tokens) {
        const reading = tokens.getPermutationsReading(span.file);
        return permutations.label === reading.label ? undefined : permutations.label;
    }
    return permutations.others.length > 0 ? permutations.label : undefined;
}

function formatHelp(help: string | undefined): string[] {
    return help === undefined ? [] : [`  help: ${help}`];
}

function formatSourceLines(
    span: Span,
    text: string,
    help: string | undefined,
    tint: (text: string) => string,
    width: number | undefined,
): string[] {
    const source = getSourceLine(span, text);
    const number = String(source.line);
    const gutter = `  ${number} | `;
    const blank = `  ${" ".repeat(number.length)} | `;
    const shown = fitToWidth(source, (width ?? LINE_WIDTH) - gutter.length);
    const indent = " ".repeat(shown.column - 1);
    const carets = "^".repeat(shown.length);
    const line = `${gutter}${shown.text}`;
    const marker = `${blank}${indent}${tint(carets)}`;
    if (help === undefined) return [line, marker];
    const fits = width === undefined || `${blank}${indent}${carets} ${help}`.length <= width;
    return fits ? [line, `${marker} ${help}`] : [line, marker, `${blank}${indent}${help}`];
}

function fitToWidth(
    source: { text: string; column: number; length: number },
    width: number,
): { text: string; column: number; length: number } {
    const { text, column, length } = source;
    if (text.length <= width) return source;
    const start = Math.max(0, Math.min(column - 1 - Math.floor(width / 3), text.length - width));
    const end = start + width;
    let shown = text.slice(start, end);
    if (start > 0) shown = `…${shown.slice(1)}`;
    if (end < text.length) shown = `${shown.slice(0, -1)}…`;
    const at = column - start;
    return { text: shown, column: at, length: Math.max(1, Math.min(length, width - at)) };
}

function getLocation(span: Span, { cwd, entryFile }: ProblemContext) {
    const file = relative(cwd, getFilePath(entryFile, span.file));
    const { line, column } = span.start;
    return { file, line, column };
}

function compareByLocation(
    { location: a }: LocatedProblem,
    { location: b }: LocatedProblem,
): number {
    if (!a || !b) return Number(!a) - Number(!b);
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line || a.column - b.column;
}
