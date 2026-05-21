import { useHost } from "../host/host-provider";
import { useDiscard, usePendingChanges, usePendingChangesCount } from "../store/hooks";
import { Icon } from "./Shell";
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
        <div className="design-actions" role="toolbar" aria-label="Design changes actions">
            <button
                type="button"
                className="design-actions-toggle"
                data-state={diffOpen ? "open" : "closed"}
                onClick={onToggleDiff}
                disabled={!hasChanges}
                aria-expanded={diffOpen}
                aria-controls={diffPanelId}
            >
                <Icon name="caret" className="design-actions-toggle-icon" />
                <span className="design-actions-toggle-count">{pendingCount}</span>
                <span className="design-actions-toggle-word">
                    {pendingCount === 1 ? "change" : "changes"}
                </span>
            </button>
            <div className="design-actions-end">
                {feedback}
                <button
                    type="button"
                    className="design-actions-discard"
                    onClick={handleDiscard}
                    disabled={!hasChanges || saving}
                    aria-label={`${discardLabel} all pending design changes`}
                >
                    {discardLabel}
                </button>
                <button
                    type="button"
                    className="design-actions-save"
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
