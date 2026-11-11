import { type DesignTokens, type Span, getFilePath, getSourceLine } from "@sugarcube-sh/dtcg";
import { relative } from "pathe";
import color from "picocolors";
import type { Reported } from "../types/diagnostics.js";
import { plural } from "./plural.js";

export interface Where {
    cwd: string;
    entryFile: string;
    configFile?: string;
    tokens?: DesignTokens;
}

interface Placed {
    problem: Reported;
    location?: { file: string; line: number; column: number };
}

export interface ProblemBlock {
    severity: Reported["severity"];
    text: string;
}

interface Look {
    colors?: boolean;
    width?: number;
}

const LINE_WIDTH = 100;

export function problemsText(
    problems: readonly Reported[],
    where: Where,
    { ending, ...look }: Look & { ending?: string } = {},
): string {
    if (problems.length === 0) return "";
    const count = problemCount(problems);
    const failed = problems.some(({ severity }) => severity === "error");
    const last = failed && ending ? `${count} ${ending}` : count;
    const blocks = problemBlocks(problems, where, look).map(({ text }) => text);
    return [...blocks, last].join("\n\n");
}

export function problemBlocks(
    problems: readonly Reported[],
    where: Where,
    { colors: colored, width }: Look = {},
): ProblemBlock[] {
    const colors = colored === undefined ? color : color.createColors(colored);
    const files = where.tokens?.toMemory().files;
    const tint: Record<Reported["severity"], (text: string) => string> = {
        error: colors.red,
        warning: colors.yellow,
        info: colors.cyan,
        hint: colors.cyan,
    };
    const placeText = (span: Span | undefined) => {
        if (span) {
            const { file, line, column } = locationOf(span, where);
            return colors.cyan(file) + colors.yellow(`:${line}:${column}`);
        }
        const { cwd, configFile } = where;
        return configFile ? colors.cyan(relative(cwd, configFile)) : "";
    };
    return problems
        .map((problem) => ({
            problem,
            ...(problem.span && { location: locationOf(problem.span, where) }),
        }))
        .sort(byPlace)
        .map(({ problem }: Placed) => {
            const { span, severity, kind, help } = problem;
            const place = placeText(span);
            const heading = tint[severity](severity) + colors.gray(`[${kind}]`);
            const permutations = permutationsNamed(problem, where.tokens);
            const written = span && files?.[span.file];
            const frame =
                span && written !== undefined
                    ? sourceLines(span, written, help, tint[severity], width)
                    : helpLines(help);
            const related = (problem.relatedInformation ?? []).map(
                ({ message, span: at }) => `  ${placeText(at)}  ${message}`,
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

export function problemCount(problems: readonly Reported[]): string {
    const errors = problems.filter(({ severity }) => severity === "error").length;
    const warnings = problems.filter(({ severity }) => severity === "warning").length;
    const counted = [
        ...(errors > 0 ? [plural(errors, "error")] : []),
        ...(warnings > 0 ? [plural(warnings, "warning")] : []),
    ];
    return `${counted.join(" and ")}.`;
}

function permutationsNamed(
    problem: Reported,
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

function helpLines(help: string | undefined): string[] {
    return help === undefined ? [] : [`  help: ${help}`];
}

function sourceLines(
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
    const shown = visiblePart(source, (width ?? LINE_WIDTH) - gutter.length);
    const indent = " ".repeat(shown.column - 1);
    const carets = "^".repeat(shown.length);
    const line = `${gutter}${shown.text}`;
    const marker = `${blank}${indent}${tint(carets)}`;
    if (help === undefined) return [line, marker];
    const fits = width === undefined || `${blank}${indent}${carets} ${help}`.length <= width;
    return fits ? [line, `${marker} ${help}`] : [line, marker, `${blank}${indent}${help}`];
}

function visiblePart(
    source: { text: string; column: number; length: number },
    room: number,
): { text: string; column: number; length: number } {
    const { text, column, length } = source;
    if (text.length <= room) return source;
    const start = Math.max(0, Math.min(column - 1 - Math.floor(room / 3), text.length - room));
    const end = start + room;
    let shown = text.slice(start, end);
    if (start > 0) shown = `…${shown.slice(1)}`;
    if (end < text.length) shown = `${shown.slice(0, -1)}…`;
    const at = column - start;
    return { text: shown, column: at, length: Math.max(1, Math.min(length, room - at)) };
}

function locationOf(span: Span, { cwd, entryFile }: Where) {
    const file = relative(cwd, getFilePath(entryFile, span.file));
    const { line, column } = span.start;
    return { file, line, column };
}

function byPlace({ location: a }: Placed, { location: b }: Placed): number {
    if (!a || !b) return Number(!a) - Number(!b);
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line || a.column - b.column;
}
