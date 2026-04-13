import { useMemo } from "react";
import { Section } from "../components/Section";
import {
    type SlimToken,
    type TokenDiffEntry,
    computeDiff,
    useTokenStore,
} from "../store/TokenStore";
import { SubmitPRDialog } from "./SubmitPRDialog";

/**
 * CHANGES — a code-shaped diff view of every token the user has edited
 * away from the project's snapshot defaults.
 *
 * The point of this section is to make the demo's value proposition
 * literal: the tweakpane is just editing DTCG token JSON. So we render
 * the diff as code — the slim author-facing token shape, pretty-printed
 * with `-` lines for the snapshot value and `+` lines for the new value,
 * grouped under a path header that doubles as the "filename".
 *
 * v1 is intentionally simple — minus block, then plus block, no
 * line-level diffing or syntax highlighting. The data shape is already
 * an array of formatted lines, which is exactly what a syntax
 * highlighter or proper line-diff algorithm would consume; both are
 * straightforward additions later.
 */

/**
 * Pretty-print a slim token with each line prefixed by `marker` (e.g.
 * `- ` or `+ `). JSON.stringify with 2-space indent preserves the key
 * order we set in `slimToken` ($value first). The result is a single
 * string suitable for rendering inside a `<pre>` block — no per-line
 * `<span>` gymnastics that turned out to render as zero-height rows
 * inside this project's CSS reset.
 */
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

function DiffEntry({ entry }: { entry: TokenDiffEntry }) {
    const fromBlock = useMemo(() => formatTokenBlock(entry.from, "-"), [entry.from]);
    const toBlock = useMemo(() => formatTokenBlock(entry.to, "+"), [entry.to]);

    return (
        <div className="tweakpane-diff-entry">
            <div className="tweakpane-diff-header">
                <span className="tweakpane-diff-path">{entry.path}</span>
                {entry.contexts.length > 0 && (
                    <span className="tweakpane-diff-contexts">{entry.contexts.join(", ")}</span>
                )}
            </div>
            <pre className="tweakpane-diff-code tweakpane-diff-minus">{fromBlock}</pre>
            <pre className="tweakpane-diff-code tweakpane-diff-plus">{toBlock}</pre>
        </div>
    );
}

export function DiffSection() {
    // Subscribe to `resolved` (a stable reference that only changes when
    // tokens are actually edited) and compute the diff in a memo. We
    // can't use `selectDiff` as a zustand selector directly because it
    // returns a fresh array every call — zustand would treat each call
    // as a state change and trigger an infinite render loop.
    const resolved = useTokenStore((state) => state.resolved);
    const resetAll = useTokenStore((state) => state.resetAll);
    const diff = useMemo(() => computeDiff(resolved), [resolved]);
    const count = diff.length;

    return (
        <Section title={`CHANGES (${count})`} defaultExpanded={count > 0}>
            {count === 0 ? (
                <p className="tweakpane-diff-empty">No changes yet — tweak something.</p>
            ) : (
                <>
                    <div className="tweakpane-diff-actions">
                        <SubmitPRDialog />
                        <button type="button" className="tweakpane-diff-reset" onClick={resetAll}>
                            Reset all
                        </button>
                    </div>
                    <div className="tweakpane-diff-list">
                        {groupBySourceFile(diff).map(([sourcePath, entries]) => (
                            <div key={sourcePath} className="tweakpane-diff-file-group">
                                <div className="tweakpane-diff-file-header">
                                    <span className="tweakpane-diff-file-path">{sourcePath}</span>
                                    <span className="tweakpane-diff-file-count">
                                        {entries.length}{" "}
                                        {entries.length === 1 ? "change" : "changes"}
                                    </span>
                                </div>
                                {entries.map((entry) => (
                                    <DiffEntry
                                        key={`${entry.path}\u0000${entry.contexts.join(",")}`}
                                        entry={entry}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Section>
    );
}
