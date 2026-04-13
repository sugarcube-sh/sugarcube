/// <reference types="@vitejs/devtools-kit" />

import { fileURLToPath } from "node:url";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import type { Plugin } from "vite";

const clientPath = fileURLToPath(new URL("./client", import.meta.url));

export default function sugarcubeStudio(): Plugin {
    return {
        name: "sugarcube:studio",

        devtools: {
            setup(ctx) {
                ctx.views.hostStatic("/__studio/", clientPath);

                ctx.docks.register({
                    id: "sugarcube-studio",
                    title: "Studio",
                    icon: "ph:diamond-duotone",
                    type: "iframe",
                    url: "/__studio/",
                });

                // Find the sugarcube plugin context
                const sugarcubePlugin = ctx.viteConfig.plugins.find(
                    (p) => p.name === "sugarcube:api"
                );
                const scCtx = sugarcubePlugin?.api?.getContext();

                if (!scCtx) {
                    console.warn(
                        "[studio] Could not find sugarcube plugin context. Is @sugarcube-sh/vite installed?"
                    );
                    return;
                }

                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:get-tokens",
                        type: "query",
                        setup: () => ({
                            handler: async () => {
                                await scCtx.ready;
                                const permutations = scCtx.config?.variables?.permutations ?? [];
                                return {
                                    tokens: scCtx.tokens,
                                    config: {
                                        resolver: scCtx.config?.resolver ?? null,
                                        tokenDirs: scCtx.getTokenDirs(),
                                    },
                                    permutations: permutations.map((p) => ({
                                        input: p.input,
                                        selector: p.selector,
                                    })),
                                };
                            },
                        }),
                    })
                );
            },
        },
    };
}
