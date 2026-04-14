import { Section } from "../../components/Section";
import { type ControlContext, renderSectionContent } from "../../controls/resolver";
import { usePathIndex, useStudioConfig } from "../../store/hooks";

export function EditView() {
    const config = useStudioConfig();
    const pathIndex = usePathIndex();

    if (!config) {
        return <p className="studio-empty">No panel configuration provided.</p>;
    }

    const ctx: ControlContext = {
        colorScale: config.colorScale,
        pathIndex,
    };

    const sections = config.panel ?? [];

    return (
        <div className="studio-edit-view">
            {sections.map((section, i) => (
                <Section
                    key={section.title}
                    title={section.title.toUpperCase()}
                    defaultExpanded={i === 0}
                >
                    {renderSectionContent(section, ctx)}
                </Section>
            ))}
        </div>
    );
}
