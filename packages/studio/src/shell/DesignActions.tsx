import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useCallback } from "react";
import { useHost } from "../host/host-provider";
import { useDiscard, usePendingChanges, usePendingChangesCount } from "../store/hooks";
import { useSave } from "./use-save";

type DesignActionsProps = {
    diffOpen: boolean;
    onToggleDiff: () => void;
    diffPanelId: string;
};

export function DesignActions({ diffOpen, onToggleDiff, diffPanelId }: DesignActionsProps) {
    const host = useHost();
    const pendingCount = usePendingChangesCount();
    const diff = usePendingChanges();
    const discard = useDiscard();
    const save = useSave(diff);

    const handleDiscard = useCallback(async () => {
        save.reset();
        await discard();
    }, [save, discard]);

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
            <button
                type="button"
                onClick={save.onSave}
                disabled={save.saving}
                aria-label={save.label}
            >
                {save.label}
            </button>
            {save.feedback}
        </div>
    );
}
