import { useCallback, useState } from "react";
import { rpcDiscard, rpcSave } from "../providers/rpc-client";
import { usePendingChangesCount, useStudioMode } from "../store/hooks";

type SaveState = "idle" | "saving" | "saved" | "error";

type DesignActionsProps = {
    /** Whether the diff panel is currently open. */
    diffOpen: boolean;
    /** Toggle the diff panel open/closed. */
    onToggleDiff: () => void;
    /** ID of the diff panel element this control toggles. */
    diffPanelId: string;
};

/**
 * Sticky footer for the Design area. Renders only when there are pending changes.
 * Contains:
 *   - A change-count disclosure that toggles the diff panel open/closed
 *   - Discard and Save actions
 */
export function DesignActions({ diffOpen, onToggleDiff, diffPanelId }: DesignActionsProps) {
    const mode = useStudioMode();
    const pendingCount = usePendingChangesCount();

    const [saveState, setSaveState] = useState<SaveState>("idle");

    const handleSave = useCallback(async () => {
        setSaveState("saving");
        try {
            await rpcSave();
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2000);
        } catch {
            setSaveState("error");
        }
    }, []);

    const handleDiscard = useCallback(() => {
        rpcDiscard();
    }, []);

    const saveLabel =
        saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : mode === "devtools"
                ? "Save"
                : "Submit as PR";

    const changesLabel = `${pendingCount} ${pendingCount === 1 ? "change" : "changes"}`;

    return (
        <div className="design-actions" role="toolbar" aria-label="Design changes actions">
            <button
                type="button"
                onClick={onToggleDiff}
                aria-expanded={diffOpen}
                aria-controls={diffPanelId}
            >
                <span aria-hidden="true">{diffOpen ? "▾" : "▸"}</span>
                <span>{changesLabel}</span>
            </button>
            <button
                type="button"
                onClick={handleDiscard}
                aria-label="Discard all pending design changes"
            >
                Discard
            </button>
            <button
                type="button"
                onClick={handleSave}
                disabled={saveState === "saving"}
                aria-label={saveLabel}
            >
                {saveLabel}
            </button>
        </div>
    );
}
