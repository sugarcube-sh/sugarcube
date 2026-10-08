import { clientPath, pageScriptPath } from "@sugarcube-sh/studio/client";
import {
    type StudioTokenSource,
    createNodeTokenSource,
    studioDevframe,
} from "@sugarcube-sh/studio/server";
import { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "@sugarcube-sh/vite";
import { viteDevframeHub } from "@devframes/vite/hub";
import type { Plugin } from "vite";

const MISSING_SUGARCUBE_PLUGIN =
    "Could not find the sugarcube plugin context. Is @sugarcube-sh/vite in this Vite config?";

export function reloadingWith(source: StudioTokenSource): Plugin {
    return {
        name: "sugarcube:studio:reload",
        apply: "serve",

        configResolved(config) {
            const plugin = config.plugins.find((p) => p.name === SUGARCUBE_API_PLUGIN_NAME);
            const context = plugin?.api?.getContext() as SugarcubePluginContext | undefined;
            if (!context) {
                config.logger.warn(MISSING_SUGARCUBE_PLUGIN);
                return;
            }
            context.onReload(() => {
                source.reloadTokens().catch((error: unknown) => {
                    config.logger.error(
                        `[studio] ${error instanceof Error ? error.message : String(error)}`,
                    );
                });
            });
        },
    };
}

export default function sugarcubeStudio(): Plugin[] {
    const source = createNodeTokenSource();
    const definition = studioDevframe({ source, clientAssets: clientPath });

    return [
        reloadingWith(source),
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
