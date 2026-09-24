import { fileURLToPath } from "node:url";
import { devframeViteBridge } from "@devframes/vite/single";
import type { InternalConfig } from "@sugarcube-sh/core";
import type { Plugin } from "vite";
import { createNodeTokenSource } from "../server/token-source";
import { studioDevframe } from "../server/definition";

const resolver = fileURLToPath(new URL("../../demo/tokens.resolver.json", import.meta.url));
const demoDir = fileURLToPath(new URL("../../demo/", import.meta.url));

export function demoStudio(): Plugin[] {
    const source = createNodeTokenSource({
        loadConfig: async () =>
            ({ resolver, variables: { permutations: undefined } }) as unknown as InternalConfig,
    });

    const definition = studioDevframe({ source });

    const watch: Plugin = {
        name: "studio:demo-tokens",
        apply: "serve",
        configureServer(server) {
            server.watcher.add(demoDir);
            server.watcher.on("change", (file) => {
                if (!file.startsWith(demoDir) || !file.endsWith(".json")) return;
                source.reloadTokens().catch((error) => {
                    server.config.logger.error(
                        `[studio] Reloading demo tokens failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
                });
            });
        },
    };

    return [devframeViteBridge(definition, { auth: false }), watch];
}
