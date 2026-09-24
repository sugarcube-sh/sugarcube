import { ChangeBar } from "./ChangeBar";
import { Inspector } from "./Inspector";

export function InspectorPane() {
    return (
        <div className="inspector-pane">
            <div className="inspector-pane-body">
                <section className="inspector-pane-edit" aria-label="Edit">
                    <Inspector />
                </section>
            </div>
            <ChangeBar />
        </div>
    );
}
