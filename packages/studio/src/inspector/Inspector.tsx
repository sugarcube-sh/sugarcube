import { renderSectionContent } from "../controls/resolver";
import { useSelectedPath } from "../pages/NodeRoute";
import { FieldRenderer } from "../rows/FieldRenderer";
import { useCurrentContext, usePathIndex, useStudioConfig, useTokenStore } from "../store/hooks";
import { FieldGroup, FieldHeader, FieldIndex, FieldSection, FieldTitle } from "./Field";
import { sectionsFor } from "./bindings";
import { useEditorRows } from "./use-editor-rows";

export function Inspector() {
    const path = useSelectedPath();
    const pathIndex = usePathIndex();
    const context = useCurrentContext();
    const resolved = useTokenStore((state) => state.resolved);
    const rows = useEditorRows();

    const token = path ? pathIndex.readToken(resolved, path, context) : undefined;

    if (path) {
        return (
            <div>
                <SelectionHeader path={path} />
                {rows.length === 0 ? (
                    <p className="inspector-empty text-quiet">
                        {token ? (
                            <>
                                No control for <code>{token.$type ?? "untyped"}</code> tokens yet.
                            </>
                        ) : (
                            "Nothing to change on this group. Select a token in it."
                        )}
                    </p>
                ) : (
                    rows.map((row) => <FieldRenderer key={row.key} row={row} />)
                )}
            </div>
        );
    }

    return <ConfigPanel />;
}

function SelectionHeader({ path }: { path: string }) {
    return (
        <section aria-labelledby="inspector-selection">
            <FieldSection defaultOpen>
                <FieldHeader id="inspector-selection">
                    <div className="cluster cluster-gap-100">
                        <FieldTitle>{path}</FieldTitle>
                    </div>
                </FieldHeader>
                <FieldGroup />
            </FieldSection>
        </section>
    );
}

function ConfigPanel() {
    const config = useStudioConfig();
    const sections = sectionsFor("", config);

    if (sections.length === 0) {
        return <p className="inspector-empty text-quiet">Select a token to edit it.</p>;
    }

    return (
        <div>
            {sections.map((section, i) => {
                const slug = section.title.toLowerCase().replace(/\s+/g, "-");
                const headingId = `inspector-section-${slug}-${i}`;
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
