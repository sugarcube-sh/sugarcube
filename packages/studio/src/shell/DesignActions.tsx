import { useHost } from "../host/host-provider";
import { useDiscard, usePendingChanges, usePendingChangesCount } from "../store/hooks";
import { Icon } from "../components/ui/icon/Icons";
import { useSave } from "./use-save";

type DesignActionsProps = {
    diffOpen: boolean;
    onToggleDiff: () => void;
    diffPanelId: string;
};

export function DesignActions({ diffOpen, onToggleDiff, diffPanelId }: DesignActionsProps) {
    const { discardLabel } = useHost().capabilities;
    const pendingCount = usePendingChangesCount();
    const diff = usePendingChanges();
    const discard = useDiscard();
    const { saving, label, feedback, onSave, reset: resetSave } = useSave(diff);

    const hasChanges = pendingCount > 0;

    const handleDiscard = async () => {
        resetSave();
        await discard();
    };

    return (
        <div className="design-actions repel" role="toolbar" aria-label="Design changes actions">
            <button
                type="button"
                className="button design-actions-trigger"
                data-state={diffOpen ? "open" : "closed"}
                onClick={onToggleDiff}
                disabled={!hasChanges}
                aria-expanded={diffOpen}
                aria-controls={diffPanelId}
            >
                <span className="tabular-nums">{pendingCount}</span>
                <span className="text-quiet">{pendingCount === 1 ? "change" : "changes"}</span>
                <Icon name="caret-sort" className="design-actions-trigger-icon" />
            </button>
            <div className="cluster" data-cluster-wrap="nowrap">
                {feedback}
                <button
                    type="button"
                    className="button"
                    data-role="tertiary"
                    onClick={handleDiscard}
                    disabled={!hasChanges || saving}
                    aria-label={`${discardLabel} all pending design changes`}
                >
                    {discardLabel}
                </button>
                <button
                    type="button"
                    className="button"
                    data-role="primary"
                    onClick={onSave}
                    disabled={saving || !hasChanges}
                    data-state={saving ? "saving" : "idle"}
                >
                    {label}
                </button>
            </div>
        </div>
    );
}
