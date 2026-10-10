import { plural } from "@sugarcube-sh/core";
import { withoutRoot } from "@sugarcube-sh/dtcg";
import { extname } from "pathe";
import color from "picocolors";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { MARKUP_EXTENSIONS } from "../constants/markup.js";
import type { Dependent, Impact, Unused } from "./answers.js";
import { shortfallOf } from "../scan-stylesheets.js";
import type { Use, Uses } from "./uses.js";

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

function table(columns: Column[], rows: Cell[][]): string[] {
    const last = columns.length - 1;
    const widthOf = (index: number, cells: Cell[][]) =>
        Math.max(
            columns[index]?.title.length ?? 0,
            ...cells.map((row) => row[index]?.text.length ?? 0),
        );
    const fixed = columns.slice(0, last).map((_, index) => widthOf(index, rows));
    const taken = fixed.reduce((sum, width) => sum + width + GAP.length, 0);
    const budget = Math.max(12, (process.stdout.columns ?? 100) - taken - MARGIN);
    const cells = rows.map((row) =>
        row.map((cell, index) =>
            index === last ? { ...cell, text: truncate(cell.text, budget) } : cell,
        ),
    );
    const widths = [...fixed, widthOf(last, cells)];
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

function groupAndName(path: string): [group: string, name: string] {
    const shown = withoutRoot(path);
    const lastDot = shown.lastIndexOf(".");
    return lastDot === -1 ? ["(root)", shown] : [shown.slice(0, lastDot), shown.slice(lastDot + 1)];
}

export function unusedLines({ unused }: Unused, tokens: Iterable<string>): string[] {
    const sizes = new Map<string, number>();
    for (const path of tokens) {
        const [group] = groupAndName(path);
        sizes.set(group, (sizes.get(group) ?? 0) + 1);
    }
    const names = new Map<string, string[]>();
    for (const path of unused) {
        const [group, name] = groupAndName(path);
        names.set(group, [...(names.get(group) ?? []), name]);
    }
    const rows = [...names.keys()].sort().map((group) => {
        const leaves = (names.get(group) ?? []).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
        );
        const whole = leaves.length > 1 && leaves.length === sizes.get(group);
        return [
            { text: group },
            { text: String(leaves.length), style: color.yellow },
            { text: whole ? "all" : leaves.join(" "), style: whole ? color.yellow : color.dim },
        ];
    });
    return table(
        [{ title: "Group" }, { title: "Unused", align: "right" }, { title: "Tokens" }],
        rows,
    );
}

export function unusedSummary({ unused, total }: Unused, uses: Uses): string {
    const { forVarReferences, forUtilityClasses } = uses.scanned;
    const files = new Set([...forVarReferences, ...forUtilityClasses]);
    const markup = [...files].filter((file) =>
        MARKUP_EXTENSIONS.has(extname(file).slice(1).toLowerCase()),
    );
    const read = color.dim(
        `Read ${plural(files.size - markup.length, "stylesheet")} and ${plural(markup.length, "markup file")}.`,
    );
    if (unused.length === 0) return `${color.greenBright("No unused tokens ✨")}  ${read}`;
    return `${color.yellow(`${unused.length} of ${total} tokens unused.`)} ${read}`;
}

export function shortfall(uses: Uses, asking: "unused" | "impact"): string | undefined {
    const found = shortfallOf({ files: uses.scanned.forVarReferences, unread: uses.unread });
    if (found?.kind === "nothing-read") {
        return asking === "unused"
            ? ERROR_MESSAGES.ANALYZE_UNUSED_NO_FILES_SCANNED(process.cwd())
            : ERROR_MESSAGES.ANALYZE_IMPACT_NO_FILES_SCANNED(process.cwd());
    }
    if (found?.kind === "unread") return ERROR_MESSAGES.ANALYZE_UNREAD_STYLESHEETS(found.unread);
    return undefined;
}

export function impactHeading({ token }: Impact): string {
    const authored = token.authored?.value;
    const value = typeof authored === "string" ? `   ${color.dim(authored)}` : "";
    return `${color.bold(token.path)}${value}`;
}

interface Row {
    path: string;
    drawn: string;
    again: boolean;
}

export function impactLines({ token, dependents, uses }: Impact): string[] {
    if (dependents.length === 0 && uses.length === 0) return [];
    const usesBy = new Map<string, Use[]>();
    for (const each of uses) usesBy.set(each.token, [...(usesBy.get(each.token) ?? []), each]);
    const usesOf = (path: string) => usesBy.get(path)?.length ?? 0;
    const under = new Map<string, { path: string; again: boolean }[]>();
    for (const { path, references, inDefault } of dependents) {
        const home = inDefault ?? references[0];
        for (const reference of references) {
            under.set(reference, [
                ...(under.get(reference) ?? []),
                { path, again: reference !== home },
            ]);
        }
    }

    const rows: Row[] = [];
    const fullRow = new Map<string, number>();
    const walk = (path: string, prefix: string, again: boolean, root: boolean, end: boolean) => {
        if (!again) fullRow.set(path, rows.length);
        const branch = root ? "" : `${prefix}${end ? "└─ " : "├─ "}`;
        rows.push({ path, drawn: `${branch}${path}`, again });
        if (again) return;
        const kids = (under.get(path) ?? []).sort(
            (a, b) => usesOf(b.path) - usesOf(a.path) || a.path.localeCompare(b.path),
        );
        const inner = root ? "" : `${prefix}${end ? "   " : "│  "}`;
        kids.forEach((kid, index) =>
            walk(kid.path, inner, kid.again, false, index === kids.length - 1),
        );
    };
    walk(token.path, "", false, true, true);

    const labels = new Map(dependents.map(({ path, label }: Dependent) => [path, label]));
    const marker = ({ path, again }: Row, index: number) => {
        const label = labels.get(path);
        if (!label) return "";
        if (!again) return ` (${label})`;
        return ` (${label}, ${(fullRow.get(path) ?? 0) < index ? "above" : "below"})`;
    };

    return table(
        [{ title: "Token" }, { title: "Uses", align: "right" }, { title: "Where" }],
        rows.map((row, index) => {
            const count = usesOf(row.path);
            const muted = count === 0;
            return [
                { text: `${row.drawn}${marker(row, index)}`, ...(muted && { style: color.dim }) },
                { text: String(count), style: muted ? color.dim : color.yellow },
                { text: where(usesBy.get(row.path) ?? []), style: color.dim },
            ];
        }),
    );
}

export function impactSummary({ token, dependents, uses }: Impact): string {
    if (uses.length > 0) {
        const files = new Set(uses.map(({ file }) => file)).size;
        return color.yellow(`${plural(uses.length, "use")} in ${plural(files, "file")}.`);
    }
    if (dependents.length > 0) return "No scanned file uses it or a token built on it.";
    return `No token references ${token.path}, and no scanned file uses it.`;
}

function where(uses: Use[]): string {
    const names = shortestNames([...new Set(uses.map(({ file }) => file))]);
    if (names.length <= 3) return names.join("  ");
    return `${names.slice(0, 2).join("  ")}  +${names.length - 2} more`;
}

function shortestNames(files: string[]): string[] {
    const parts = files.map((file) => file.split("/").filter(Boolean));
    const ending = (own: string[], depth: number) => own.slice(-depth).join("/");
    return parts.map((own) => {
        for (let depth = 1; depth < own.length; depth++) {
            const name = ending(own, depth);
            if (!parts.some((other) => other !== own && ending(other, depth) === name)) {
                return name;
            }
        }
        return own.join("/");
    });
}
