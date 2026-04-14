import { useMemo } from "react";
import { computeDiff } from "../../store/compute-diff";
import type { SlimToken, TokenDiffEntry } from "../../store/types";
import { usePathIndex, useStudioMode, useTokenStore } from "../store/hooks";
import { Section } from "./Section";
import { SubmitPRDialog } from "./SubmitPRDialog";

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
        <div>
            <div>
                <span>{entry.path}</span>
                {entry.contexts.length > 0 && <span>{entry.contexts.join(", ")}</span>}
            </div>
            <pre>{fromBlock}</pre>
            <pre>{toBlock}</pre>
        </div>
    );
}

export function DiffSection() {
    const mode = useStudioMode();
    const resolved = useTokenStore((state) => state.resolved);
    const resetAll = useTokenStore((state) => state.resetAll);
    const pathIndex = usePathIndex();
    const snapshotResolved = pathIndex.getSnapshot().resolved;

    const diff = useMemo(
        () => computeDiff(resolved, snapshotResolved, pathIndex),
        [resolved, snapshotResolved, pathIndex]
    );
    const count = diff.length;

    return (
        <Section title={`CHANGES (${count})`} defaultExpanded={count > 0}>
            {count === 0 ? (
                <p>No changes yet — tweak something.</p>
            ) : (
                <>
                    <div>
                        {mode !== "devtools" && <SubmitPRDialog />}
                        <button type="button" onClick={resetAll}>
                            Reset all
                        </button>
                    </div>
                    <div>
                        {groupBySourceFile(diff).map(([sourcePath, entries]) => (
                            <div key={sourcePath}>
                                <div>
                                    <span>{sourcePath}</span>
                                    <span>
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
