import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useHost } from "../host/host-provider";
import type { SaveResult } from "../host/types";
import { useDiscard, usePendingChanges, usePendingChangesCount } from "../store/hooks";
import { diffToFileEdits } from "../tokens/diff-to-edits";
import type { TokenDiffEntry } from "../tokens/types";

type SaveStatus =
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "persisted" }
    | { kind: "pr-submitted"; number: number; url: string }
    | { kind: "failed"; error: string };

type DesignActionsProps = {
    diffOpen: boolean;
    onToggleDiff: () => void;
    diffPanelId: string;
};

export function DesignActions({ diffOpen, onToggleDiff, diffPanelId }: DesignActionsProps) {
    const host = useHost();
    const pendingCount = usePendingChangesCount();
    const diff = usePendingChanges();
    const diffRef = useRef(diff);
    diffRef.current = diff;
    const discard = useDiscard();

    const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(idleTimerRef.current), []);

    const handleSave = useCallback(async () => {
        clearTimeout(idleTimerRef.current);
        setStatus({ kind: "saving" });

        const bundle = buildSaveBundle(diffRef.current ?? []);
        const result = await host.save(bundle);

        setStatus(result);

        if (result.kind === "persisted") {
            // Auto-clear the "Saved" pip after 2s. PR-submitted state
            // sticks around so the user can click through to the PR.
            idleTimerRef.current = setTimeout(() => setStatus({ kind: "idle" }), 2000);
        }
    }, [host]);

    const handleDiscard = useCallback(async () => {
        clearTimeout(idleTimerRef.current);
        setStatus({ kind: "idle" });
        await discard();
    }, [discard]);

    const saveLabel = renderSaveLabel(status, host.capabilities.saveLabel);
    const feedback = renderFeedback(status);
    const saving = status.kind === "saving";

    const changesLabel = `${pendingCount} ${pendingCount === 1 ? "change" : "changes"}`;

    return (
        <div className="design-actions" role="toolbar" aria-label="Design changes actions">
            <button
                type="button"
                onClick={onToggleDiff}
                aria-expanded={diffOpen}
                aria-controls={diffPanelId}
            >
                {diffOpen ? <ChevronDownIcon aria-hidden /> : <ChevronRightIcon aria-hidden />}
                <span>{changesLabel}</span>
            </button>
            <button
                type="button"
                onClick={handleDiscard}
                aria-label={`${host.capabilities.discardLabel} all pending design changes`}
            >
                {host.capabilities.discardLabel}
            </button>
            <button type="button" onClick={handleSave} disabled={saving} aria-label={saveLabel}>
                {saveLabel}
            </button>
            {feedback}
        </div>
    );
}

function buildSaveBundle(diff: TokenDiffEntry[]) {
    const files = diffToFileEdits(diff);
    const title =
        diff.length === 1 && diff[0] ? `Update ${diff[0].path}` : `Update ${diff.length} tokens`;
    return { title, description: "", files };
}

function renderSaveLabel(status: SaveStatus, defaultLabel: string): string {
    switch (status.kind) {
        case "saving":
            return "Saving…";
        case "persisted":
            return "Saved";
        case "pr-submitted":
            return `PR #${status.number} opened`;
        case "failed":
        case "idle":
            return defaultLabel;
    }
}

function renderFeedback(status: SaveStatus): ReactNode {
    switch (status.kind) {
        case "failed":
            return <span role="alert">{status.error}</span>;
        case "pr-submitted":
            return (
                <a href={status.url} target="_blank" rel="noopener noreferrer">
                    View PR #{status.number}
                </a>
            );
        default:
            return null;
    }
}

// Result type re-exported from host/types via this module so callers
// downstream that previously imported from this file keep working.
export type { SaveResult };
