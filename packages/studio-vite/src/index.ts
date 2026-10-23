import { clientPath, pageScriptPath } from "@sugarcube-sh/studio/client";
import {
    ErrorMessages,
    STUDIO_VITE_PLUGIN,
    type StudioFiles,
    studioDevframe,
} from "@sugarcube-sh/studio/server";
import { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "@sugarcube-sh/vite";
import { viteDevframeHub } from "@devframes/vite/hub";
import type { Plugin } from "vite";

export function filesFromSugarcube(): { plugin: Plugin; files: Promise<StudioFiles> } {
    let found: (files: StudioFiles) => void = () => {};
    const files = new Promise<StudioFiles>((resolve) => {
        found = resolve;
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
            found({ now: () => context, onChange: context.onReload });
        },
    };

    return { plugin, files };
}

export default function sugarcubeStudio(): Plugin[] {
    const { plugin, files } = filesFromSugarcube();
    const definition = studioDevframe({ files, clientAssets: clientPath });

    return [
        plugin,
        viteDevframeHub({
            devframes: [
                {
                    devframe: definition,
                    dock: { clientScript: { importFrom: pageScriptPath, eager: true } },
                },
            ],
            auth: false,
            quiet: true,
        }),
    ];
}
