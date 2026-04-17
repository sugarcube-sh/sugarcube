import { useMemo } from "react";
import type { SlimToken, TokenDiffEntry } from "../../../store/types";
import { usePendingChanges } from "../../store/hooks";

function formatTokenBlock(token: SlimToken, marker: string): string {
    return JSON.stringify(token, null, 2)
        .split("\n")
        .map((line) => `${marker} ${line}`)
        .join("\n");
}

function groupBySourceFile(entries: TokenDiffEntry[]): [string, TokenDiffEntry[]][] {
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

/**
 * TODO: Replace raw JSON + marker prefixes with syntax-highlighted diff.
 * Shiki (https://shiki.style) is a good fit — it runs in the browser,
 * supports JSON grammar, and has a built-in diff mode via
 * `codeToHtml({ lang: 'json', decorations })` or the transformerDiff plugin.
 * Lightweight enough to bundle in an iframe.
 */
function DiffEntry({ entry }: { entry: TokenDiffEntry }) {
    const fromBlock = useMemo(() => formatTokenBlock(entry.from, "-"), [entry.from]);
    const toBlock = useMemo(() => formatTokenBlock(entry.to, "+"), [entry.to]);

    return (
        <article aria-label={`Change to ${entry.path}`}>
            <h3>
                <code>{entry.path}</code>
            </h3>
            {entry.contexts.length > 0 && (
                <p>
                    <span>Applies to: </span>
                    <span>{entry.contexts.join(", ")}</span>
                </p>
            )}
            <pre aria-label="Previous value">{fromBlock}</pre>
            <pre aria-label="New value">{toBlock}</pre>
        </article>
    );
}

export function DiffView() {
    const diff = usePendingChanges();

    if (diff.length === 0) {
        return <p>No changes yet — tweak something.</p>;
    }

    const grouped = groupBySourceFile(diff);

    return (
        <div>
            {grouped.map(([sourcePath, entries], i) => {
                const headingId = `diff-file-${sourcePath.replace(/[^a-z0-9]/gi, "-")}-${i}`;
                return (
                    <section key={sourcePath} aria-labelledby={headingId}>
                        <header>
                            <h2 id={headingId}>
                                <code>{sourcePath}</code>
                            </h2>
                            <p>
                                {entries.length} {entries.length === 1 ? "change" : "changes"}
                            </p>
                        </header>
                        {entries.map((entry) => (
                            <DiffEntry
                                key={`${entry.path}\u0000${entry.contexts.join(",")}`}
                                entry={entry}
                            />
                        ))}
                    </section>
                );
            })}
        </div>
    );
}
