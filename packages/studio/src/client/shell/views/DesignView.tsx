import { type ControlContext, renderSectionContent } from "../../controls/resolver";
import { usePathIndex, useStudioConfig } from "../../store/hooks";

export function DesignView() {
    const config = useStudioConfig();
    const pathIndex = usePathIndex();

    if (!config) {
        return <p>No panel configuration provided.</p>;
    }

    const ctx: ControlContext = {
        colorScale: config.colorScale,
        pathIndex,
    };

    const sections = config.panel ?? [];

    return (
        <div>
            {sections.map((section) => {
                const headingId = `design-section-${section.title.toLowerCase().replace(/\s+/g, "-")}`;
                return (
                    <section key={section.title} aria-labelledby={headingId}>
                        <details open>
                            <summary>
                                <h2 id={headingId}>{section.title}</h2>
                            </summary>
                            <div className="section-content">
                                {renderSectionContent(section, ctx)}
                            </div>
                        </details>
                    </section>
                );
            })}
        </div>
    );
}
