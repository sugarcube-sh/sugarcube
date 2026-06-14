import { type ReactNode, useCallback, useRef, useState } from "react";
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

type UseSaveResult = {
    saving: boolean;
    label: string;
    feedback: ReactNode;
    onSave: () => Promise<void>;
    reset: () => void;
};

export function useSave(diff: readonly TokenDiffEntry[]): UseSaveResult {
    const host = useHost();
    const diffRef = useRef(diff);
    diffRef.current = diff;

    const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

    const reset = useCallback(() => setStatus({ kind: "idle" }), []);

    const onSave = useCallback(async () => {
        setStatus({ kind: "saving" });
        const result = await host.save(buildSaveBundle(diffRef.current));
        setStatus(result);
    }, [host]);

    return {
        saving: status.kind === "saving",
        label: status.kind === "saving" ? "Saving…" : host.capabilities.saveLabel,
        feedback: renderFeedback(status),
        onSave,
        reset,
    };
}

function buildSaveBundle(diff: readonly TokenDiffEntry[]): SaveBundle {
    const files = diffToFileEdits(diff);
    const title =
        diff.length === 1 && diff[0] ? `Update ${diff[0].path}` : `Update ${diff.length} tokens`;
    return { title, description: "", files };
}

function renderFeedback(status: SaveStatus): ReactNode {
    switch (status.kind) {
        case "pr-submitted":
            return (
                <a
                    className="save-pr-link inline-flex items-center text-sm text-accent-fill-loud no-underline"
                    href={status.url}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View PR #{status.number}
                </a>
            );
        case "failed":
            return (
                <span
                    className="save-error inline-flex items-center text-sm text-error-fill-loud"
                    role="alert"
                >
                    {status.error}
                </span>
            );
        default:
            return null;
    }
}
