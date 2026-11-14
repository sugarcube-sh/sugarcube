import { viteDevframeHub } from "@devframes/vite/hub";
import { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "@sugarcube-sh/vite";
import type { Plugin } from "vite";
import { BUILT_APP } from "../built-files";
import { ErrorMessages } from "../error-messages";
import { createStudioHub } from "../hub/studio-hub";
import { createStudioDevframe } from "../server/definition";
import type { StudioFiles } from "../server/files";
import { STUDIO_VITE_PLUGIN } from "../studio-names";

export function createFilesPlugin(): { plugin: Plugin; files: Promise<StudioFiles> } {
    let resolveFiles: (files: StudioFiles) => void = () => {};
    const files = new Promise<StudioFiles>((resolve) => {
        resolveFiles = resolve;
    });

    const plugin: Plugin = {
        name: STUDIO_VITE_PLUGIN,
        apply: "serve",

        configResolved(config) {
            const sugarcube = config.plugins.find((p) => p.name === SUGARCUBE_API_PLUGIN_NAME);
            const context = sugarcube?.api?.getContext() as SugarcubePluginContext | undefined;
            if (!context) {
                config.logger.warn(ErrorMessages.NO_SUGARCUBE_PLUGIN);
                return;
            }
            resolveFiles({ getSnapshot: () => context, onChange: context.onReload });
        },
    };

    return { plugin, files };
}

export default function sugarcubeStudio(): Plugin[] {
    const { plugin, files } = createFilesPlugin();
    const hub = createStudioHub(createStudioDevframe({ files, clientAssets: BUILT_APP }));

    return [plugin, viteDevframeHub({ ...hub, auth: false, quiet: true })];
}
