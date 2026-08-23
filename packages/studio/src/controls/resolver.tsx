import type { PanelSection } from "@sugarcube-sh/core/client";
import type { ReactNode } from "react";
import { FieldRenderer } from "../rows/FieldRenderer";
import { expand, withSectionDefaults } from "../rows/expand";
import {
    useBaseline,
    useCurrentContext,
    usePathIndex,
    useStudioConfig,
    useTokenStore,
} from "../store/hooks";

export function renderSectionContent(section: PanelSection): ReactNode {
    return <SectionRows section={section} />;
}

function SectionRows({ section }: { section: PanelSection }) {
    const baseline = useBaseline();
    const pathIndex = usePathIndex();
    const context = useCurrentContext();
    const colorScale = useStudioConfig()?.colorScale;
    // Swatches generate from the working tokens, so this section re-expands on every edit. Good candidate for future perf improvements.
    const resolved = useTokenStore((state) => state.resolved);

    const ctx = { baseline, pathIndex, context, colorScale, resolved };
    const rows = section.bindings.flatMap((binding) =>
        expand(withSectionDefaults(section, binding), ctx),
    );

    return rows.map((row) => <FieldRenderer key={row.key} row={row} />);
}
