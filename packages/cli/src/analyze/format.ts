import type { TokenGraph, TokenNode } from "@sugarcube-sh/core";
import color from "picocolors";
import type { VarRef } from "../lint/scan-css.js";
import { UTILITY_SOURCE } from "./scan-utilities.js";

const ROOT_GROUP = "(root)";

export interface UnusedGroup {
    group: string;
    leaves: string[];
    total: number;
}

function compareLeaf(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true });
}

export function groupUnused(graph: TokenGraph, unusedPaths: string[]): UnusedGroup[] {
    const totals = new Map<string, number>();
    for (const node of graph.nodes.values()) {
        const group = node.group || ROOT_GROUP;
        totals.set(group, (totals.get(group) ?? 0) + 1);
    }

    const leavesByGroup = new Map<string, string[]>();
    for (const path of unusedPaths) {
        const node = graph.nodes.get(path);
        const group = node?.group || ROOT_GROUP;
        const leaf = node?.name ?? path;
        leavesByGroup.set(group, [...(leavesByGroup.get(group) ?? []), leaf]);
    }

    return [...leavesByGroup.keys()].sort().map((group) => ({
        group,
        leaves: (leavesByGroup.get(group) ?? []).sort(compareLeaf),
        total: totals.get(group) ?? 0,
    }));
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function formatUnusedTable(groups: UnusedGroup[]): string[] {
    const groupWidth = Math.max("Group".length, ...groups.map((g) => g.group.length));
    const countWidth = Math.max(
        "Unused".length,
        ...groups.map((g) => String(g.leaves.length).length),
    );

    // Fit the Tokens column to the terminal, leaving room for the sidebar.
    const termWidth = process.stdout.columns ?? 80;
    const tokensBudget = Math.max(16, termWidth - groupWidth - countWidth - 8);

    const rows = groups.map((g) => {
        const count = g.leaves.length;
        const tokens =
            count > 1 && count === g.total ? "all" : truncate(g.leaves.join(" "), tokensBudget);
        return { group: g.group, count, tokens, whole: count > 1 && count === g.total };
    });

    const tokensWidth = Math.max("Tokens".length, ...rows.map((r) => r.tokens.length));
    const rule = color.dim("─".repeat(groupWidth + countWidth + tokensWidth + 8));

    const header = color.dim(
        `${"Group".padEnd(groupWidth)}   ${"Unused".padStart(countWidth)}   Tokens`,
    );

    const lines = [header, rule];
    for (const row of rows) {
        const group = row.group.padEnd(groupWidth);
        const count = color.yellow(String(row.count).padStart(countWidth));
        const tokens = row.whole ? color.yellow(row.tokens) : color.dim(row.tokens);
        lines.push(`${group}   ${count}   ${tokens}`);
    }
    return lines;
}

export function whereSummary(refs: VarRef[]): string {
    const files: string[] = [];
    const seen = new Set<string>();
    for (const ref of refs) {
        const file = ref.file === UTILITY_SOURCE ? "utilities" : (ref.file.split("/").pop() ?? "");
        if (!seen.has(file)) {
            seen.add(file);
            files.push(file);
        }
    }
    if (files.length <= 3) return files.join("  ");
    return `${files.slice(0, 2).join("  ")}  +${files.length - 2} more`;
}

export interface UsageRow {
    token: string;
    refs: number;
    where: string;
}

export interface ImpactRow extends UsageRow {
    references: string;
    axis?: string;
}

function axisSuffix(axis?: string): string {
    return axis ? ` (${axis})` : "";
}

export function formatImpactTable(rows: ImpactRow[]): string[] {
    const tokenW = Math.max("Token".length, ...rows.map((r) => r.token.length));
    const referencesOf = (row: ImpactRow) => `${row.references}${axisSuffix(row.axis)}`;
    const refByW = Math.max("References".length, ...rows.map((r) => referencesOf(r).length));
    const refsW = Math.max("Uses".length, ...rows.map((r) => String(r.refs).length));

    const termWidth = process.stdout.columns ?? 100;
    const whereBudget = Math.max(12, termWidth - tokenW - refByW - refsW - 13);

    const header = color.dim(
        `${"Token".padEnd(tokenW)}   ${"References".padEnd(refByW)}   ${"Uses".padStart(refsW)}   Where`,
    );
    const whereW = Math.max(
        "Where".length,
        ...rows.map((r) => Math.min(r.where.length, whereBudget)),
    );
    const rule = color.dim("─".repeat(tokenW + refByW + refsW + whereW + 9));

    const lines = [header, rule];
    for (const row of rows) {
        const muted = row.refs === 0;
        const token = (muted ? color.dim : (s: string) => s)(row.token.padEnd(tokenW));
        const references = color.dim(referencesOf(row).padEnd(refByW));
        const refs = (muted ? color.dim : color.yellow)(String(row.refs).padStart(refsW));
        const where = color.dim(truncate(row.where, whereBudget));
        lines.push(`${token}   ${references}   ${refs}   ${where}`);
    }
    return lines;
}

export function formatImpactBrief(rows: UsageRow[]): string[] {
    const shown = [...rows]
        .filter((row) => row.refs > 0)
        .sort((a, b) => b.refs - a.refs || a.token.localeCompare(b.token));
    if (shown.length === 0) return [color.dim("No tokens are referenced directly in code.")];

    const tokenW = Math.max("Token".length, ...shown.map((r) => r.token.length));
    const refsW = Math.max("Uses".length, ...shown.map((r) => String(r.refs).length));
    const termWidth = process.stdout.columns ?? 100;
    const whereBudget = Math.max(12, termWidth - tokenW - refsW - 10);

    const header = color.dim(`${"Token".padEnd(tokenW)}   ${"Uses".padStart(refsW)}   Where`);
    const whereW = Math.max(
        "Where".length,
        ...shown.map((r) => Math.min(r.where.length, whereBudget)),
    );
    const lines = [header, color.dim("─".repeat(tokenW + refsW + whereW + 6))];
    for (const row of shown) {
        const refs = color.yellow(String(row.refs).padStart(refsW));
        lines.push(
            `${row.token.padEnd(tokenW)}   ${refs}   ${color.dim(truncate(row.where, whereBudget))}`,
        );
    }
    return lines;
}

export interface ImpactTreeInput {
    /** The token the tree is rooted at. */
    target: string;
    /** Each dependent mapped to every hop one step closer to the target. */
    parents: Map<string, string[]>;
    /** The one hop each dependent's subtree hangs off. */
    chosen: Map<string, string>;
    refsByToken: Map<string, VarRef[]>;
    /** For dependents with several parents, name the reason they vary or the axis along which they do, e.g. `"per variant"`. */
    elided?: Map<string, string>;
}

export function formatImpactTree({
    target,
    parents,
    chosen,
    refsByToken,
    elided = new Map(),
}: ImpactTreeInput): string[] {
    const children = new Map<string, { id: string; echo: boolean }[]>();
    for (const [child, hops] of parents) {
        for (const parent of hops) {
            const kids = children.get(parent) ?? [];
            kids.push({ id: child, echo: parent !== chosen.get(child) });
            children.set(parent, kids);
        }
    }
    const refsOf = (id: string) => refsByToken.get(id)?.length ?? 0;

    const walked: { id: string; branch: string; echo: boolean }[] = [];
    const walk = (id: string, prefix: string, isRoot: boolean, isLast: boolean, echo = false) => {
        walked.push({ id, branch: isRoot ? "" : `${prefix}${isLast ? "└─ " : "├─ "}`, echo });
        if (echo) return;

        const kids = (children.get(id) ?? []).sort(
            (a, b) => refsOf(b.id) - refsOf(a.id) || a.id.localeCompare(b.id),
        );
        const childPrefix = isRoot ? "" : `${prefix}${isLast ? "   " : "│  "}`;
        kids.forEach((kid, i) => walk(kid.id, childPrefix, false, i === kids.length - 1, kid.echo));
    };
    walk(target, "", true, true);

    const fullRowOf = (id: string) => walked.findIndex((row) => row.id === id && !row.echo);
    const marker = (row: (typeof walked)[number], index: number) => {
        const axis = elided.get(row.id);
        if (!axis) return "";
        if (!row.echo) return axisSuffix(axis);
        return ` (${axis}, ${fullRowOf(row.id) < index ? "above" : "below"})`;
    };

    const nodes = walked.map((row, index) => ({
        id: row.id,
        label: `${row.branch}${row.id}${marker(row, index)}`,
    }));

    const labelW = Math.max("Token".length, ...nodes.map((n) => n.label.length));
    const refsW = Math.max("Uses".length, ...nodes.map((n) => String(refsOf(n.id)).length));
    const termWidth = process.stdout.columns ?? 100;
    const whereBudget = Math.max(12, termWidth - labelW - refsW - 8);

    const whereW = Math.max(
        "Where".length,
        ...nodes.map((n) =>
            Math.min(whereSummary(refsByToken.get(n.id) ?? []).length, whereBudget),
        ),
    );
    const header = color.dim(`${"Token".padEnd(labelW)}   ${"Uses".padStart(refsW)}   Where`);
    const rule = color.dim("─".repeat(labelW + refsW + whereW + 6));

    const rows = nodes.map((n) => {
        const refs = refsOf(n.id);
        const muted = refs === 0;
        const label = muted ? color.dim(n.label.padEnd(labelW)) : n.label.padEnd(labelW);
        const refsStr = (muted ? color.dim : color.yellow)(String(refs).padStart(refsW));
        const where = color.dim(truncate(whereSummary(refsByToken.get(n.id) ?? []), whereBudget));
        return `${label}   ${refsStr}   ${where}`;
    });

    return [header, rule, ...rows];
}

export function tokenValue(node: TokenNode): string {
    const context = Object.keys(node.perContext)[0];
    const raw = context ? node.perContext[context]?.raw : undefined;
    return typeof raw === "string" ? `   ${color.dim(raw)}` : "";
}
