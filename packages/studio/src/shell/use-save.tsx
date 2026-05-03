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
    /** Clear status + cancel the auto-dismiss timer. Called by the discard flow. */
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
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const reset = useCallback(() => {
        clearTimeout(timerRef.current);
        setStatus({ kind: "idle" });
    }, []);

    const onSave = useCallback(async () => {
        clearTimeout(timerRef.current);
        setStatus({ kind: "saving" });

        const result = await host.save(buildSaveBundle(diffRef.current));
        setStatus(result);

        if (result.kind === "persisted") {
            // Auto-clear the "Saved" pip. PR-submitted state sticks around
            // so the user can click through to the PR.
            timerRef.current = setTimeout(() => setStatus({ kind: "idle" }), SAVED_PIP_DURATION_MS);
        }
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
