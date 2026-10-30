import { type DevframeDefinition, defineDevframe } from "devframe";
import { STUDIO_SURFACE, defineStudio } from "./define-studio";
import { createDevframeBridge } from "./devframe-bridge";
import type { GitSaveSettings } from "../protocol";
import type { StudioFiles } from "./files";
import { STUDIO_ICON } from "./icon";

export type StudioDevframeOptions = {
    files: StudioFiles | Promise<StudioFiles>;
    clientAssets?: string;
    gitSave?: GitSaveSettings | undefined;
};

export function studioDevframe(options: StudioDevframeOptions): DevframeDefinition {
    const { files, clientAssets, gitSave } = options;

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
            await defineStudio(await files, createDevframeBridge(ctx), { gitSave });
        },
    });
}
