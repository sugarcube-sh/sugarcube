import { useId, useState } from "react";
import { useHasPendingChanges } from "../../store/hooks";
import { DesignActions } from "../DesignActions";
import { DesignView } from "../views/DesignView";
import { DiffView } from "../views/DiffView";

export function DesignArea() {
    const hasChanges = useHasPendingChanges();
    const [diffOpen, setDiffOpen] = useState(false);
    const [hadChanges, setHadChanges] = useState(hasChanges);
    const diffPanelId = useId();

    if (hadChanges !== hasChanges) {
        setHadChanges(hasChanges);
        if (!hasChanges) setDiffOpen(false);
    }

    const showDiff = hasChanges && diffOpen;

    return (
        <div className="design-area">
            <div className="design-area-body">
                <section className="design-area-edit" aria-label="Edit">
                    <DesignView />
                </section>
            </div>
            {showDiff && (
                <section
                    id={diffPanelId}
                    className="design-area-diff"
                    aria-label="Pending changes diff"
                >
                    <DiffView />
                </section>
            )}
            <DesignActions
                diffOpen={showDiff}
                onToggleDiff={() => setDiffOpen((open) => !open)}
                diffPanelId={diffPanelId}
            />
        </div>
    );
}
