import { pluralize } from "@sugarcube-sh/core";
import { tokenPath } from "@sugarcube-sh/dtcg";
import { extname } from "pathe";
import color from "picocolors";
import { ErrorMessages } from "../constants/error-messages.js";
import { MARKUP_EXTENSIONS } from "../constants/markup.js";
import { getScanWarning } from "../scan-stylesheets.js";
import type { Dependent, Impact, Unused } from "./answers.js";
import type { TokenUse, TokenUses } from "./uses.js";

const GAP = "   ";
const MARGIN = 4;

interface Column {
    title: string;
    align?: "right";
}

interface Cell {
    text: string;
    style?: (text: string) => string;
}

function formatTable(columns: Column[], rows: Cell[][]): string[] {
    const last = columns.length - 1;
    const widthOf = (index: number, cells: Cell[][]) =>
        Math.max(
            columns[index]?.title.length ?? 0,
            ...cells.map((row) => row[index]?.text.length ?? 0),
        );
    const fixedWidths = columns.slice(0, last).map((_, index) => widthOf(index, rows));
    const fixedWidth = fixedWidths.reduce((sum, width) => sum + width + GAP.length, 0);
    const lastWidth = Math.max(12, (process.stdout.columns ?? 100) - fixedWidth - MARGIN);
    const cells = rows.map((row) =>
        row.map((cell, index) =>
            index === last ? { ...cell, text: truncate(cell.text, lastWidth) } : cell,
        ),
    );
    const widths = [...fixedWidths, widthOf(last, cells)];
    const pad = (text: string, index: number) => {
        if (index === last) return text;
        const width = widths[index] ?? 0;
        return columns[index]?.align === "right" ? text.padStart(width) : text.padEnd(width);
    };
    const line = (row: Cell[]) =>
        row
            .map(({ text, style }, index) => {
                const padded = pad(text, index);
                return style ? style(padded) : padded;
            })
            .join(GAP);
    const total = widths.reduce((sum, width) => sum + width, 0) + GAP.length * last;
    return [
        color.dim(columns.map(({ title }, index) => pad(title, index)).join(GAP)),
        color.dim("─".repeat(total)),
        ...cells.map(line),
    ];
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

function splitGroupAndName(path: string): [group: string, name: string] {
    const shown = tokenPath.removeRoot(path);
    const group = tokenPath.getParent(shown) ?? "";
    return group === "" ? ["(root)", shown] : [group, tokenPath.getName(shown)];
}

export function formatUnusedTable({ unused }: Unused, tokens: Iterable<string>): string[] {
    const sizeByGroup = new Map<string, number>();
    for (const path of tokens) {
        const [group] = splitGroupAndName(path);
        sizeByGroup.set(group, (sizeByGroup.get(group) ?? 0) + 1);
    }
    const namesByGroup = new Map<string, string[]>();
    for (const path of unused) {
        const [group, name] = splitGroupAndName(path);
        namesByGroup.set(group, [...(namesByGroup.get(group) ?? []), name]);
    }
    const rows = [...namesByGroup.keys()].sort().map((group) => {
        const names = (namesByGroup.get(group) ?? []).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
        );
        const isWholeGroup = names.length > 1 && names.length === sizeByGroup.get(group);
        return [
            { text: group },
            { text: String(names.length), style: color.yellow },
            {
                text: isWholeGroup ? "all" : names.join(" "),
                style: isWholeGroup ? color.yellow : color.dim,
            },
        ];
    });
    return formatTable(
        [{ title: "Group" }, { title: "Unused", align: "right" }, { title: "Tokens" }],
        rows,
    );
}

export function formatUnusedSummary({ unused, total }: Unused, uses: TokenUses): string {
    const files = new Set([...uses.scanned.stylesheets, ...uses.scanned.markup]);
    const markup = [...files].filter((file) =>
        MARKUP_EXTENSIONS.has(extname(file).slice(1).toLowerCase()),
    );
    const read = color.dim(
        `Read ${pluralize(files.size - markup.length, "stylesheet")} and ${pluralize(markup.length, "markup file")}.`,
    );
    if (unused.length === 0) return `${color.greenBright("No unused tokens ✨")}  ${read}`;
    return `${color.yellow(`${unused.length} of ${total} tokens unused.`)} ${read}`;
}

export function formatAnalyzeWarning(
    uses: TokenUses,
    command: "unused" | "impact",
): string | undefined {
    const warning = getScanWarning({ files: uses.scanned.stylesheets, unread: uses.unread });
    if (warning?.kind === "nothing-read") {
        return command === "unused"
            ? ErrorMessages.ANALYZE_UNUSED_NO_FILES_SCANNED(process.cwd())
            : ErrorMessages.ANALYZE_IMPACT_NO_FILES_SCANNED(process.cwd());
    }
    if (warning?.kind === "unread") return ErrorMessages.ANALYZE_UNREAD_STYLESHEETS(warning.unread);
    return undefined;
}

export function formatImpactHeading({ path, definitions }: Impact): string {
    const values = [
        ...new Set(
            definitions.flatMap(({ token }) => {
                const value = token.original?.value;
                return typeof value === "string" ? [value] : [];
            }),
        ),
    ];
    const width = (process.stdout.columns ?? 100) - MARGIN;
    const indent = path.length + GAP.length;
    const lines: string[][] = [[]];
    let length = indent;
    for (const value of values) {
        const line = lines.at(-1) ?? [];
        const needed = (line.length > 0 ? GAP.length : 0) + value.length;
        if (line.length > 0 && length + needed > width) {
            lines.push([value]);
            length = indent + value.length;
        } else {
            line.push(value);
            length += needed;
        }
    }
    return lines
        .map((line, index) => {
            const start = index === 0 ? color.bold(path) : " ".repeat(path.length);
            return line.length > 0 ? `${start}${GAP}${color.dim(line.join(GAP))}` : start;
        })
        .join("\n");
}

interface Row {
    path: string;
    text: string;
    isRepeat: boolean;
}

export function formatImpactTree({ path: analysed, dependents, uses }: Impact): string[] {
    if (dependents.length === 0 && uses.length === 0) return [];
    const usesBy = new Map<string, TokenUse[]>();
    for (const each of uses) usesBy.set(each.token, [...(usesBy.get(each.token) ?? []), each]);
    const usesOf = (path: string) => usesBy.get(path)?.length ?? 0;
    const childrenByPath = new Map<string, { path: string; again: boolean }[]>();
    for (const { path, references, defaultReference: inDefault } of dependents) {
        const mainReference = inDefault ?? references[0];
        for (const reference of references) {
            childrenByPath.set(reference, [
                ...(childrenByPath.get(reference) ?? []),
                { path, again: reference !== mainReference },
            ]);
        }
    }

    const rows: Row[] = [];
    const firstRowByPath = new Map<string, number>();
    const walk = (path: string, prefix: string, again: boolean, root: boolean, end: boolean) => {
        if (!again) firstRowByPath.set(path, rows.length);
        const branch = root ? "" : `${prefix}${end ? "└─ " : "├─ "}`;
        rows.push({ path, text: `${branch}${path}`, isRepeat: again });
        if (again) return;
        const children = (childrenByPath.get(path) ?? []).sort(
            (a, b) => usesOf(b.path) - usesOf(a.path) || a.path.localeCompare(b.path),
        );
        const inner = root ? "" : `${prefix}${end ? "   " : "│  "}`;
        children.forEach((kid, index) =>
            walk(kid.path, inner, kid.again, false, index === children.length - 1),
        );
    };
    walk(analysed, "", false, true, true);

    const labels = new Map(dependents.map(({ path, label }: Dependent) => [path, label]));
    const marker = ({ path, isRepeat: again }: Row, index: number) => {
        const label = labels.get(path);
        if (!label) return "";
        if (!again) return ` (${label})`;
        return ` (${label}, ${(firstRowByPath.get(path) ?? 0) < index ? "above" : "below"})`;
    };

    return formatTable(
        [{ title: "Token" }, { title: "Uses", align: "right" }, { title: "Where" }],
        rows.map((row, index) => {
            const count = usesOf(row.path);
            const muted = count === 0;
            return [
                { text: `${row.text}${marker(row, index)}`, ...(muted && { style: color.dim }) },
                { text: String(count), style: muted ? color.dim : color.yellow },
                { text: formatFiles(usesBy.get(row.path) ?? []), style: color.dim },
            ];
        }),
    );
}

export function formatImpactSummary({ path, dependents, uses }: Impact): string {
    if (uses.length > 0) {
        const files = new Set(uses.map(({ file }) => file)).size;
        return color.yellow(`${pluralize(uses.length, "use")} in ${pluralize(files, "file")}.`);
    }
    if (dependents.length > 0) return "No scanned file uses it or a token built on it.";
    return `No token references ${path}, and no scanned file uses it.`;
}

function formatFiles(uses: TokenUse[]): string {
    const names = getShortestNames([...new Set(uses.map(({ file }) => file))]);
    if (names.length <= 3) return names.join("  ");
    return `${names.slice(0, 2).join("  ")}  +${names.length - 2} more`;
}

function getShortestNames(files: string[]): string[] {
    const parts = files.map((file) => file.split("/").filter(Boolean));
    const getEnding = (segments: string[], depth: number) => segments.slice(-depth).join("/");
    return parts.map((own) => {
        for (let depth = 1; depth < own.length; depth++) {
            const name = getEnding(own, depth);
            if (!parts.some((other) => other !== own && getEnding(other, depth) === name)) {
                return name;
            }
        }
        return own.join("/");
    });
}
