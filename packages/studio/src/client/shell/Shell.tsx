import { useState } from "react";
import { NavRail, type ViewId } from "./NavRail";
import { ChangesView } from "./views/ChangesView";
import { EditView } from "./views/EditView";
import { ScalesView } from "./views/ScalesView";
import { TokensView } from "./views/TokensView";

export function Shell() {
    const [activeView, setActiveView] = useState<ViewId>("edit");

    return (
        <div>
            <NavRail active={activeView} onChange={setActiveView} />
            <main>
                {activeView === "edit" && <EditView />}
                {activeView === "changes" && <ChangesView />}
                {activeView === "tokens" && <TokensView />}
                {activeView === "scales" && <ScalesView />}
            </main>
        </div>
    );
}
