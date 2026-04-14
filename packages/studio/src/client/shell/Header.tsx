import { useCallback, useState } from "react";
import { rpcDiscard, rpcSave } from "../providers/rpc-client";
import { usePendingChangesCount, useStudioMode } from "../store/hooks";

type SaveState = "idle" | "saving" | "saved" | "error";

export function Header() {
    const mode = useStudioMode();
    const pendingCount = usePendingChangesCount();
    const hasChanges = pendingCount > 0;

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

    return (
        <header>
            <h1>Sugarcube</h1>
            <div role="toolbar" aria-label="Studio actions">
                <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={!hasChanges}
                    aria-label="Discard all pending changes"
                >
                    Discard
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges || saveState === "saving"}
                    aria-label={saveLabel}
                >
                    {saveLabel}
                </button>
            </div>
        </header>
    );
}
