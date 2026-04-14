import { useCallback, useState } from "react";
import { DiffSection } from "../../components/DiffSection";
import { rpcDiscard, rpcSave } from "../../providers/rpc-client";
import { useStudioMode } from "../../store/hooks";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ChangesView() {
    const mode = useStudioMode();
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

    const handleDiscard = useCallback(async () => {
        await rpcDiscard();
    }, []);

    return (
        <div className="studio-changes-view">
            {mode === "devtools" && (
                <div className="studio-changes-actions">
                    <button
                        type="button"
                        className="studio-save-button"
                        onClick={handleSave}
                        disabled={saveState === "saving"}
                    >
                        {saveState === "saving"
                            ? "Saving..."
                            : saveState === "saved"
                              ? "Saved"
                              : "Save to disk"}
                    </button>
                    <button type="button" className="studio-discard-button" onClick={handleDiscard}>
                        Discard all
                    </button>
                </div>
            )}
            <DiffSection />
        </div>
    );
}
