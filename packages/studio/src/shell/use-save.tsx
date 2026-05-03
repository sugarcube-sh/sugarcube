/**
 * Encapsulates the save button's state machine: status (idle / saving /
 * persisted / pr-submitted / failed), the auto-clear timer for the
 * "Saved" pip, and the rendering of the button label + feedback element.
 *
 * Returns a render-ready surface so DesignActions can stay purely layout.
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useHost } from "../host/host-provider";
import type { SaveBundle } from "../host/types";
import { diffToFileEdits } from "../tokens/diff-to-edits";
import type { TokenDiffEntry } from "../tokens/types";

type SaveStatus =
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "persisted" }
    | { kind: "pr-submitted"; number: number; url: string }
    | { kind: "failed"; error: string };

const SAVED_PIP_DURATION_MS = 2000;

export type UseSaveResult = {
    /** True while a save is in flight; the button should be disabled. */
    saving: boolean;
    /** Button label for the current status (e.g. "Save", "Saving…", "PR #12 opened"). */
    label: string;
    /** Feedback element to render alongside the button (error span, PR link, or null). */
    feedback: ReactNode;
    /** Trigger a save with the current diff. */
    onSave: () => Promise<void>;
    /** Clear status. Called by the discard flow to reset the pip. */
    reset: () => void;
};

/**
 * `diff` is read by reference at save time, not at hook-call time — so a
 * caller can pass an unstable diff array without retriggering the
 * `onSave` callback identity on every render.
 */
export function useSave(diff: TokenDiffEntry[]): UseSaveResult {
    const host = useHost();
    const diffRef = useRef(diff);
    diffRef.current = diff;

    const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

    // Auto-clear the "Saved" pip after the duration. Cleanup runs on
    // every status change, so any subsequent setStatus (next save,
    // discard, etc.) cancels the in-flight timer for free — no manual
    // clearTimeout calls scattered through the action handlers.
    useEffect(() => {
        if (status.kind !== "persisted") return;
        const t = setTimeout(() => setStatus({ kind: "idle" }), SAVED_PIP_DURATION_MS);
        return () => clearTimeout(t);
    }, [status.kind]);

    const reset = useCallback(() => setStatus({ kind: "idle" }), []);

    const onSave = useCallback(async () => {
        setStatus({ kind: "saving" });
        const result = await host.save(buildSaveBundle(diffRef.current));
        setStatus(result);
        // PR-submitted state sticks around so the user can click through
        // to the PR; persisted state auto-dismisses via the effect above.
    }, [host]);

    return {
        saving: status.kind === "saving",
        label: renderLabel(status, host.capabilities.saveLabel),
        feedback: renderFeedback(status),
        onSave,
        reset,
    };
}

function buildSaveBundle(diff: TokenDiffEntry[]): SaveBundle {
    const files = diffToFileEdits(diff);
    const title =
        diff.length === 1 && diff[0] ? `Update ${diff[0].path}` : `Update ${diff.length} tokens`;
    return { title, description: "", files };
}

function renderLabel(status: SaveStatus, defaultLabel: string): string {
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
