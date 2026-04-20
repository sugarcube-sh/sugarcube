import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { rpcSave } from "../providers/rpc-client";
import {
    usePendingChanges,
    usePendingChangesCount,
    useStudioMode,
    useTokenStore,
} from "../store/hooks";
import { diffToFileEdits } from "../tokens/diff-to-edits";
import type { TokenDiffEntry } from "../tokens/types";

type SaveHook = {
    saving: boolean;
    saveLabel: string;
    feedback: ReactNode;
    handleSave: () => void;
    reset: () => void;
};

function useDevToolsSave(): SaveHook {
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleSave = useCallback(async () => {
        clearTimeout(timerRef.current);
        setStatus("saving");
        setError(null);
        try {
            await rpcSave();
            setStatus("saved");
            timerRef.current = setTimeout(() => setStatus("idle"), 2000);
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Failed to save");
        }
    }, []);

    const reset = useCallback(() => {
        clearTimeout(timerRef.current);
        setStatus("idle");
        setError(null);
    }, []);

    const saveLabel = status === "saving" ? "Saving\u2026" : status === "saved" ? "Saved" : "Save";

    return {
        saving: status === "saving",
        saveLabel,
        feedback: error ? <span role="alert">{error}</span> : null,
        handleSave,
        reset,
    };
}

function useEmbeddedSave(diffRef: React.RefObject<TokenDiffEntry[]>): SaveHook {
    const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [pr, setPr] = useState<{ number: number; url: string } | null>(null);

    useEffect(function listenForSaveResult() {
        function handleMessage(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== "studio:save-result") return;

            if (data.error) {
                setStatus("error");
                setError(data.error);
            } else {
                setStatus("success");
                setPr({ number: data.number, url: data.url });
            }
        }

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const handleSave = useCallback(() => {
        setStatus("saving");
        setError(null);

        const currentDiff = diffRef.current ?? [];
        const files = diffToFileEdits(currentDiff);
        const title =
            currentDiff.length === 1 && currentDiff[0]
                ? `Update ${currentDiff[0].path}`
                : `Update ${currentDiff.length} tokens`;

        window.parent.postMessage(
            { type: "studio:save", payload: { title, description: "", files } },
            "*"
        );
    }, [diffRef]);

    const reset = useCallback(() => {
        setStatus("idle");
        setError(null);
        setPr(null);
    }, []);

    let feedback: ReactNode = null;
    if (error) {
        feedback = <span role="alert">{error}</span>;
    } else if (pr) {
        feedback = (
            <a href={pr.url} target="_blank" rel="noopener noreferrer">
                View PR #{pr.number}
            </a>
        );
    }

    const saveLabel =
        status === "saving"
            ? "Saving\u2026"
            : status === "success" && pr
              ? `PR #${pr.number} opened`
              : "Submit as PR";

    return {
        saving: status === "saving",
        saveLabel,
        feedback,
        handleSave,
        reset,
    };
}

type DesignActionsProps = {
    diffOpen: boolean;
    onToggleDiff: () => void;
    diffPanelId: string;
};

export function DesignActions({ diffOpen, onToggleDiff, diffPanelId }: DesignActionsProps) {
    const mode = useStudioMode();
    const pendingCount = usePendingChangesCount();
    const diff = usePendingChanges();
    const diffRef = useRef(diff);
    diffRef.current = diff;
    const resetAll = useTokenStore((state) => state.resetAll);

    const devtools = useDevToolsSave();
    const embedded = useEmbeddedSave(diffRef);
    const { saving, saveLabel, feedback, handleSave, reset } =
        mode === "devtools" ? devtools : embedded;

    const handleDiscard = useCallback(() => {
        reset();
        resetAll();
    }, [reset, resetAll]);

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
                aria-label="Discard all pending design changes"
            >
                Discard
            </button>
            <button type="button" onClick={handleSave} disabled={saving} aria-label={saveLabel}>
                {saveLabel}
            </button>
            {feedback}
        </div>
    );
}
