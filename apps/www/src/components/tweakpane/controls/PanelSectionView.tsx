import type { PanelSection } from "@sugarcube-sh/core/client";
import { Section } from "../components/Section";
import { type ControlContext, renderSectionContent } from "./resolver";

type PanelSectionViewProps = {
    section: PanelSection;
    ctx: ControlContext;
    defaultExpanded?: boolean;
};

/**
 * Generic section wrapper driven by the panel config. Renders the
 * section title via `Section`, then dispatches the section content
 * (palette-swap or bindings) through the resolver. No section-specific
 * logic — all behavior lives in the individual control components.
 */
export function PanelSectionView({ section, ctx, defaultExpanded = false }: PanelSectionViewProps) {
    return (
        <Section title={section.title.toUpperCase()} defaultExpanded={defaultExpanded}>
            {renderSectionContent(section, ctx)}
        </Section>
    );
}
