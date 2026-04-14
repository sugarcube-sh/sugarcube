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
        <div>
            {mode === "devtools" && (
                <div>
                    <button type="button" onClick={handleSave} disabled={saveState === "saving"}>
                        {saveState === "saving"
                            ? "Saving..."
                            : saveState === "saved"
                              ? "Saved"
                              : "Save to disk"}
                    </button>
                    <button type="button" onClick={handleDiscard}>
                        Discard all
                    </button>
                </div>
            )}
            <DiffSection />
        </div>
    );
}
