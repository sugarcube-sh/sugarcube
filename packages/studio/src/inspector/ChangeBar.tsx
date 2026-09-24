import { useId, useState } from "react";
import { useConflicts, useHasPendingChanges } from "../store/hooks";
import { DiffView } from "./DiffView";
import { InspectorActions } from "./InspectorActions";

/**
 * Pending changes and what to do with them.
 *
 * Shell-level rather than part of the editor: the editor column closes when
 * nothing is selected, and unsaved changes must not close with it.
 */
export function ChangeBar() {
    const hasChanges = useHasPendingChanges();
    const conflicts = useConflicts();
    const [diffOpen, setDiffOpen] = useState(false);
    const [hadChanges, setHadChanges] = useState(hasChanges);
    const diffPanelId = useId();

    if (hadChanges !== hasChanges) {
        setHadChanges(hasChanges);
        if (!hasChanges) setDiffOpen(false);
    }

    const showDiff = hasChanges && diffOpen;

    return (
        <div className="change-bar">
            {conflicts.length > 0 && (
                <output className="change-bar-conflicts">
                    Changed on disk while you were editing: {conflicts.join(", ")}. Saving will
                    overwrite that change.
                </output>
            )}
            {showDiff && (
                <section
                    id={diffPanelId}
                    className="change-bar-diff"
                    aria-label="Pending changes diff"
                >
                    <DiffView />
                </section>
            )}
            <InspectorActions
                diffOpen={showDiff}
                onToggleDiff={() => setDiffOpen((open) => !open)}
                diffPanelId={diffPanelId}
            />
        </div>
    );
}
