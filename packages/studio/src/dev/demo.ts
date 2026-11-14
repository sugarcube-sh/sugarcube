import { fileURLToPath } from "node:url";
import { devframeViteBridge } from "@devframes/vite/single";
import { fillDefaults } from "@sugarcube-sh/core";
import type { Plugin } from "vite";
import { ErrorMessages } from "../error-messages";
import { createStudioDevframe } from "../server/definition";
import { createNodeFiles } from "../server/node-files";

const resolverPath = fileURLToPath(new URL("../../demo/tokens.resolver.json", import.meta.url));

export async function createDemoPlugins(): Promise<Plugin[]> {
    const files = await createNodeFiles(
        { ...fillDefaults({ resolver: resolverPath }), resolver: resolverPath },
        { onError: (error) => console.error(ErrorMessages.DEMO_FAILED, error) },
    );

    const watchPlugin: Plugin = {
        name: "studio:demo-tokens",
        apply: "serve",
        configureServer(server) {
            files.watch(server.watcher);
        },
    };

    return [devframeViteBridge(createStudioDevframe({ files }), { auth: false }), watchPlugin];
}
