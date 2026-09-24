import type { PanelSection, StudioConfig } from "@sugarcube-sh/core/client";

export function sectionsFor(
    _route: string,
    config: StudioConfig | undefined,
): readonly PanelSection[] {
    return config?.panel ?? [];
}
