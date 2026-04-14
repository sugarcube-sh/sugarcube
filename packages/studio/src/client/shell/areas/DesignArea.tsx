import { useEffect, useId, useState } from "react";
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
 * Clicking the change count toggles the diff panel as a second column.
 */
export function DesignArea() {
    const pendingCount = usePendingChangesCount();
    const hasChanges = pendingCount > 0;
    const [diffOpen, setDiffOpen] = useState(false);
    const diffPanelId = useId();

    // When all changes are dismissed (or saved), close the diff panel.
    useEffect(() => {
        if (!hasChanges && diffOpen) {
            setDiffOpen(false);
        }
    }, [hasChanges, diffOpen]);

    return (
        <div className="design-area">
            <div className="design-area-body">
                <section className="design-area-edit" aria-label="Edit">
                    <DesignView />
                </section>
                {diffOpen && (
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
                    diffOpen={diffOpen}
                    onToggleDiff={() => setDiffOpen((open) => !open)}
                    diffPanelId={diffPanelId}
                />
            )}
        </div>
    );
}
