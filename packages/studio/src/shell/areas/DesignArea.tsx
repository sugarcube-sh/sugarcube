import { useId, useState } from "react";
import { usePendingChangesCount } from "../../store/hooks";
import { DesignActions } from "../DesignActions";
import { DesignView } from "../views/DesignView";
import { DiffView } from "../views/DiffView";

export function DesignArea() {
    const pendingCount = usePendingChangesCount();
    const hasChanges = pendingCount > 0;
    const [diffOpen, setDiffOpen] = useState(false);
    const diffPanelId = useId();

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
