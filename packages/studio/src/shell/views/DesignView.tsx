import { renderSectionContent } from "../../controls/resolver";
import { useStudioConfig } from "../../store/hooks";
import { FieldGroup, FieldHeader, FieldIndex, FieldSection, FieldTitle } from "../Field";

export function DesignView() {
  const config = useStudioConfig();

  if (!config) {
    return (
      <p>
        Add a <code>studio.panel</code> section to your sugarcube config to get started.
      </p>
    );
  }

  const sections = config.panel ?? [];

  return (
    <div>
      {sections.map((section, i) => {
        const slug = section.title.toLowerCase().replace(/\s+/g, "-");
        const headingId = `design-section-${slug}-${i}`;
        return (
          <section key={headingId} aria-labelledby={headingId}>
            <FieldSection defaultOpen>
              <FieldHeader id={headingId}>
                <div className="cluster cluster-gap-100">
                  <FieldIndex>{String(i + 1).padStart(2, "0")}</FieldIndex>
                  <FieldTitle>{section.title}</FieldTitle>
                </div>
              </FieldHeader>
              <FieldGroup>{renderSectionContent(section)}</FieldGroup>
            </FieldSection>
          </section>
        );
      })}
    </div>
  );
}
