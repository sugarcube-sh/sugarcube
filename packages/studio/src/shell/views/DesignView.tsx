import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "../../components/ui/collapsible/collapsible";
import { type ControlContext, renderSectionContent } from "../../controls/resolver";
import { usePathIndex, useStudioConfig } from "../../store/hooks";
import { Icon } from "../Shell";

export function DesignView() {
    const config = useStudioConfig();
    const pathIndex = usePathIndex();

    if (!config) {
        return (
            <p>
                Add a <code>studio.panel</code> section to your sugarcube config to get started.
            </p>
        );
    }

    const ctx: ControlContext = {
        colorScale: config.colorScale,
        pathIndex,
    };

    const sections = config.panel ?? [];

    return (
        <div>
            {sections.map((section, i) => {
                const slug = section.title.toLowerCase().replace(/\s+/g, "-");
                const headingId = `design-section-${slug}-${i}`;
                return (
                    <section key={headingId} aria-labelledby={headingId}>
                        <Collapsible key={headingId} defaultOpen>
                            <CollapsibleTrigger asChild>
                                <button
                                    id={headingId}
                                    className="studio-collapsible-trigger font-mono w-full cluster cluster-gap-xs"
                                    type="button"
                                >
                                    <Icon
                                        name="caret"
                                        className="studio-collapsible-trigger-icon text-quieter"
                                    />
                                    <div className="cluster cluster-gap-2xs">
                                        <span className="text-quietest text-sm">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <span className="text-sm uppercase text-quieter">
                                            {section.title}
                                        </span>
                                    </div>
                                </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="section-content">
                                {renderSectionContent(section, ctx)}
                            </CollapsibleContent>
                        </Collapsible>
                    </section>
                );
            })}
        </div>
    );
}
