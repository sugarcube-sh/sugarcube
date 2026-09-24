import { type ReactNode, useCallback, useState } from "react";
import { useHost } from "../host/host-provider";
import type { SaveBundle } from "../host/types";
import { useTokenStore } from "../store/hooks";
import { type WriteOp, opsByFile } from "../tokens/write-ops";
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
    const ops = useTokenStore((state) => state.ops);
    const adopt = useTokenStore((state) => state.adopt);

    const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

    const reset = useCallback(() => setStatus({ kind: "idle" }), []);

    const onSave = useCallback(async () => {
        setStatus({ kind: "saving" });
        const result = await host.save(buildSaveBundle(diff, ops));

        if (result.kind === "persisted") adopt();

        setStatus(result);
    }, [host, diff, ops, adopt]);

    return {
        saving: status.kind === "saving",
        label: status.kind === "saving" ? "Saving…" : host.capabilities.saveLabel,
        feedback: renderFeedback(status),
        onSave,
        reset,
    };
}

/**
 * The document recorded what it did, so that is what goes: each operation is
 * applied to the file as it stands on disk, leaving anything that changed
 * underneath alone. Whole-file text would destroy it; a diff cannot see a
 * reorder.
 */
function buildSaveBundle(diff: readonly TokenDiffEntry[], ops: readonly WriteOp[]): SaveBundle {
    const files = opsByFile(ops);
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
