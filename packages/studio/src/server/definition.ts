import { type DevframeDefinition, defineDevframe } from "devframe";
import { STUDIO_SURFACE, defineStudio } from "./define-studio";
import { createDevframeBridge } from "./devframe-bridge";
import { STUDIO_ICON } from "./icon";
import type { StudioTokenSource } from "./types";

export type StudioDevframeOptions = {
    source: StudioTokenSource;
    clientAssets?: string;
    /** Where a save goes from a build with no server. Baked into the handshake. */
    saveUrl?: string;
};

export function studioDevframe(options: StudioDevframeOptions): DevframeDefinition {
    const { source, clientAssets, saveUrl } = options;

    return defineDevframe({
        id: STUDIO_SURFACE.id,
        name: STUDIO_SURFACE.title,
        version: "0.0.0",
        packageName: "@sugarcube-sh/studio",
        importMetaUrl: import.meta.url,
        homepage: "https://sugarcube.sh",
        description: "Edit your design tokens and watch the system respond.",
        icon: STUDIO_ICON,
        dock: { title: STUDIO_SURFACE.title, icon: STUDIO_ICON },
        ...(clientAssets ? { clientAssets } : {}),
        basePath: STUDIO_SURFACE.route,
        setup: async (ctx) => {
            await defineStudio(source, createDevframeBridge(ctx), { saveUrl });
        },
    });
}
