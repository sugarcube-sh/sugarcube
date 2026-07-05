import { type ReactNode, useMemo } from "react";
import { TokenPath } from "../../controls/TokenPath";
import { usePendingChanges } from "../../store/hooks";
import type { SlimToken, TokenDiffEntry } from "../../tokens/types";

type DiffLine =
    | { kind: "context"; text: string }
    | { kind: "removed"; text: string }
    | { kind: "added"; text: string };

export function DiffView() {
    const diff = usePendingChanges();

    if (diff.length === 0) {
        return (
            <p className="text-quiet text-sm font-mono text-center p-sm">
                No changes yet — tweak something.
            </p>
        );
    }

    const grouped = groupBySourceFile(diff);

    return (
        <div className="diff-view">
            {grouped.map(([sourcePath, entries], i) => {
                const headingId = `diff-file-${sourcePath.replace(/[^a-z0-9]/gi, "-")}-${i}`;
                return (
                    <section key={sourcePath} className="diff-file" aria-labelledby={headingId}>
                        <header className="diff-file-header repel font-mono text-sm">
                            <code
                                id={headingId}
                                className="bg-transparent p-0 text-quiet truncate min-w-0"
                            >
                                {sourcePath}
                            </code>
                            <span className="shrink-0 text-quietest tabular-nums">
                                {entries.length} {entries.length === 1 ? "change" : "changes"}
                            </span>
                        </header>
                        <div className="diff-file-body">
                            {entries.map((entry) => (
                                <DiffEntry
                                    key={`${entry.path}\u0000${entry.contexts.join(",")}`}
                                    entry={entry}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function DiffEntry({ entry }: { entry: TokenDiffEntry }) {
    const lines = useMemo(() => diffTokens(entry.from, entry.to), [entry.from, entry.to]);

    return (
        <article className="diff-entry" aria-label={`Change to ${entry.path}`}>
            <header className="diff-entry-header cluster cluster-gap-2xs">
                <TokenPath path={entry.path} />
                {entry.contexts.length > 0 && (
                    <span
                        className="ms-auto text-quietest font-mono text-xs"
                        title={entry.contexts.join(", ")}
                    >
                        {entry.contexts.join(", ")}
                    </span>
                )}
            </header>
            <pre className="diff-block" aria-label="Change">
                {lines.map((line, i) => (
                    // oxlint-disable-next-line react/no-array-index-key -- lines are positional
                    <span key={i} className={`diff-line diff-line-${line.kind}`}>
                        <span className="diff-gutter" aria-hidden>
                            {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
                        </span>
                        <span className="diff-code">{highlightJson(line.text)}</span>
                    </span>
                ))}
            </pre>
        </article>
    );
}

function groupBySourceFile(entries: readonly TokenDiffEntry[]): [string, TokenDiffEntry[]][] {
    const groups = new Map<string, TokenDiffEntry[]>();
    for (const entry of entries) {
        const key = entry.sourcePath || "unknown";
        const list = groups.get(key);
        if (list) {
            list.push(entry);
        } else {
            groups.set(key, [entry]);
        }
    }
    return [...groups.entries()];
}

// ---------------------------------------------------------------------------
// Unified line diff. JSON.stringify output is structurally stable, so an LCS
// pass produces a clean "context / removed / added" stream where unchanged
// braces and keys collapse into context lines and only the changed values get
// the +/- treatment.
// ---------------------------------------------------------------------------

function diffTokens(from: SlimToken, to: SlimToken): DiffLine[] {
    const fromLines = JSON.stringify(from, null, 2).split("\n");
    const toLines = JSON.stringify(to, null, 2).split("\n");
    return diffLines(fromLines, toLines);
}

function diffLines(a: string[], b: string[]): DiffLine[] {
    const n = a.length;
    const m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
        Array.from({ length: m + 1 }, () => 0),
    );
    for (let i = 1; i <= n; i++) {
        const row = dp[i];
        const prev = dp[i - 1];
        if (!row || !prev) continue;
        for (let j = 1; j <= m; j++) {
            row[j] =
                a[i - 1] === b[j - 1]
                    ? (prev[j - 1] ?? 0) + 1
                    : Math.max(prev[j] ?? 0, row[j - 1] ?? 0);
        }
    }

    const out: DiffLine[] = [];
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            out.unshift({ kind: "context", text: a[i - 1] as string });
            i--;
            j--;
        } else if ((dp[i - 1]?.[j] ?? 0) > (dp[i]?.[j - 1] ?? 0)) {
            out.unshift({ kind: "removed", text: a[i - 1] as string });
            i--;
        } else {
            // Tie or strictly-better add path: prefer add during backtrack so
            // the final output reads "removed then added", which is conventional.
            out.unshift({ kind: "added", text: b[j - 1] as string });
            j--;
        }
    }
    while (i > 0) {
        out.unshift({ kind: "removed", text: a[i - 1] as string });
        i--;
    }
    while (j > 0) {
        out.unshift({ kind: "added", text: b[j - 1] as string });
        j--;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Minimal JSON highlighter. Returns ReactNode[] so we don't have to set
// dangerouslySetInnerHTML. Token-ref-aware: `{some.token.path}` strings get
// the accent treatment because they're the substance of most diffs.
// ---------------------------------------------------------------------------

const JSON_TOKEN_RE =
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;
const REF_INNER_RE = /^\{[\w.-]+\}$/;

function highlightJson(line: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    let i = 0;

    for (const m of line.matchAll(JSON_TOKEN_RE)) {
        const start = m.index ?? 0;
        if (start > last) {
            out.push(line.slice(last, start));
        }
        const [, str, colon, num, bool, punct] = m;

        if (str !== undefined) {
            if (colon) {
                out.push(
                    <span key={i++} className="diff-json-key">
                        {str}
                    </span>,
                    <span key={i++} className="diff-json-punct">
                        {colon}
                    </span>,
                );
            } else {
                const inner = str.slice(1, -1);
                if (REF_INNER_RE.test(inner)) {
                    out.push(
                        <span key={i++} className="diff-json-string">
                            <span className="diff-json-quote">"</span>
                            <span className="diff-json-ref">{inner}</span>
                            <span className="diff-json-quote">"</span>
                        </span>,
                    );
                } else {
                    out.push(
                        <span key={i++} className="diff-json-string">
                            {str}
                        </span>,
                    );
                }
            }
        } else if (num !== undefined) {
            out.push(
                <span key={i++} className="diff-json-num">
                    {num}
                </span>,
            );
        } else if (bool !== undefined) {
            out.push(
                <span key={i++} className="diff-json-bool">
                    {bool}
                </span>,
            );
        } else if (punct !== undefined) {
            out.push(
                <span key={i++} className="diff-json-punct">
                    {punct}
                </span>,
            );
        }

        last = start + m[0].length;
    }

    if (last < line.length) {
        out.push(line.slice(last));
    }

    return out;
}
