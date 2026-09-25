import { clientPath, pageScriptPath } from "@sugarcube-sh/studio/client";
import {
    type StudioTokenSource,
    nodeFileText,
    studioDevframe,
    writeOpsToDisk,
} from "@sugarcube-sh/studio/server";
import type { SugarcubePluginContext } from "@sugarcube-sh/vite";
import { viteDevframeHub } from "@devframes/vite/hub";
import type { Plugin } from "vite";

const SUGARCUBE_VITE_PLUGIN_NAME = "sugarcube:api";

const MISSING_SUGARCUBE_PLUGIN =
    "Could not find the sugarcube plugin context. Is @sugarcube-sh/vite in this Vite config?";

export function sourceFrom(): {
    source: StudioTokenSource;
    capture: (found: SugarcubePluginContext | null) => void;
} {
    let ctx: SugarcubePluginContext | null = null;
    let errors: readonly string[] = [];
    let capture: (found: SugarcubePluginContext | null) => void = () => {};

    const ready = new Promise<SugarcubePluginContext | null>((resolve) => {
        capture = resolve;
    }).then(async (found) => {
        ctx = found;
        if (!found) {
            errors = [MISSING_SUGARCUBE_PLUGIN];
            return;
        }
        await found.ready;
    });

    const source: StudioTokenSource = {
        ready,
        get config() {
            return ctx?.config ?? null;
        },
        get trees() {
            return ctx?.trees ?? null;
        },
        get resolved() {
            return ctx?.resolved ?? null;
        },
        get defaultContext() {
            return ctx?.defaultContext ?? null;
        },
        get sources() {
            return ctx?.sources ?? null;
        },
        get permutations() {
            return ctx?.permutations ?? [];
        },
        get errors() {
            return errors;
        },
        writeOps: (files) => writeOpsToDisk(nodeFileText, files),
        reloadTokens: async () => {
            await ctx?.reloadTokens();
        },
        onReload: (fn) => ctx?.onReload(fn),
    };

    return { source, capture };
}

export function capturePlugin(capture: (found: SugarcubePluginContext | null) => void): Plugin {
    return {
        name: "sugarcube:studio:capture",
        apply: "serve",

        configResolved(config) {
            const plugin = config.plugins.find((p) => p.name === SUGARCUBE_VITE_PLUGIN_NAME);
            capture((plugin?.api?.getContext() as SugarcubePluginContext | undefined) ?? null);
        },
    };
}

export default function sugarcubeStudio(): Plugin[] {
    const { source, capture } = sourceFrom();
    const definition = studioDevframe({ source, clientAssets: clientPath });

    return [
        capturePlugin(capture),
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
