import { useId, useState } from "react";
import { usePendingChangesCount } from "../../store/hooks";
import { DesignActions } from "../DesignActions";
import { DesignView } from "../views/DesignView";
import { DiffView } from "../views/DiffView";

/**
 * The Design area: edit controls with an optional inline diff panel.
 *
 * Default state: edit panel fills the area, no footer.
 * With pending changes: a sticky footer appears with the change count
 * (also a disclosure trigger) and Save/Discard actions.
 * Clicking the change count toggles the diff panel as a second column (styles not yet implmented).
 */
export function DesignArea() {
    const pendingCount = usePendingChangesCount();
    const hasChanges = pendingCount > 0;
    const [diffOpen, setDiffOpen] = useState(false);
    const diffPanelId = useId();

    // We only want to show the diff panel when there are pending changes.
    const showDiff = hasChanges && diffOpen;

    return (
        <div className="design-area">
            <div className="design-area-body">
                <section className="design-area-edit" aria-label="Edit">
                    <DesignView />
                </section>
                {showDiff && (
                    <section
                        id={diffPanelId}
                        className="design-area-diff"
                        aria-label="Pending changes diff"
                    >
                        <DiffView />
                    </section>
                )}
            </div>
            {hasChanges && (
                <DesignActions
                    diffOpen={showDiff}
                    onToggleDiff={() => setDiffOpen((open) => !open)}
                    diffPanelId={diffPanelId}
                />
            )}
        </div>
    );
}
