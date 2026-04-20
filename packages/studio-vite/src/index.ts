/// <reference types="@vitejs/devtools-kit" />

import type { ResolvedTokens } from "@sugarcube-sh/core";
import { PathIndex, computeDiff, diffToFileEdits } from "@sugarcube-sh/studio";
import { clientPath } from "@sugarcube-sh/studio/client";
import type { SugarcubePluginContext } from "@sugarcube-sh/vite";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import type { Plugin } from "vite";

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcSharedStates {
        "sugarcube:studio:resolved": { resolved: ResolvedTokens };
    }
}

const SUGARCUBE_VITE_PLUGIN_NAME = "sugarcube:api";

export default function sugarcubeStudio(): Plugin {
    return {
        name: "sugarcube:studio",

        devtools: {
            async setup(ctx) {
                ctx.views.hostStatic("/__studio/", clientPath);

                ctx.docks.register({
                    id: "sugarcube-studio",
                    title: "Studio",
                    icon: "ph:diamond-duotone",
                    type: "iframe",
                    url: "/__studio/",
                });

                const sugarcubePlugin = ctx.viteConfig.plugins.find(
                    (p) => p.name === SUGARCUBE_VITE_PLUGIN_NAME
                );
                const scCtx = sugarcubePlugin?.api?.getContext() as
                    | SugarcubePluginContext
                    | undefined;

                if (!scCtx) {
                    console.warn(
                        "[studio] Could not find sugarcube plugin context. Is @sugarcube-sh/vite installed?"
                    );
                    return;
                }

                await scCtx.ready;

                if (!scCtx.config || !scCtx.trees || !scCtx.resolved) {
                    console.warn(
                        "[studio] Sugarcube context resolved as ready but config/trees/resolved are missing. Skipping Studio setup."
                    );
                    return;
                }

                // Only `resolved` is shared — config/trees are static and fetched via RPC at init.
                const state = await ctx.rpc.sharedState.get("sugarcube:studio:resolved", {
                    initialValue: {
                        resolved: scCtx.resolved,
                    },
                });

                // Client edit → re-run pipeline + push CSS via HMR.
                state.on("updated", async () => {
                    const current = state.value();
                    if (!current?.resolved) return;

                    await scCtx.rerunPipeline(current.resolved);

                    if (ctx.viteServer) {
                        scCtx.invalidate(ctx.viteServer);
                    }
                });

                // Disk reload (file watcher or explicit) → push fresh state to the client.
                scCtx.onReload(() => {
                    if (!scCtx.resolved) return;
                    state.mutate((draft) => {
                        draft.resolved = scCtx.resolved as ResolvedTokens;
                    });
                });

                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:get-tokens",
                        type: "query",
                        setup: () => ({
                            handler: async () => {
                                await scCtx.ready;
                                if (!scCtx.config || !scCtx.trees || !scCtx.resolved) {
                                    throw new Error(
                                        "[studio] Sugarcube context not fully initialised"
                                    );
                                }
                                return {
                                    config: scCtx.config,
                                    trees: scCtx.trees,
                                    resolved: scCtx.resolved,
                                };
                            },
                        }),
                    })
                );

                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:save",
                        type: "action",
                        setup: () => ({
                            handler: async () => {
                                const current = state.value();
                                const baseline = scCtx.resolved;
                                if (!current?.resolved || !baseline) return;

                                const pathIndex = new PathIndex(baseline);
                                const diff = computeDiff(current.resolved, baseline, pathIndex);
                                const fileEdits = diffToFileEdits(diff);

                                for (const { path, edits } of fileEdits) {
                                    await scCtx.writeTokenEdits(path, edits);
                                }
                            },
                        }),
                    })
                );

                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:discard",
                        type: "action",
                        setup: () => ({
                            handler: async () => {
                                // `onReload` handler above writes the fresh disk state into shared state.
                                await scCtx.reloadTokens();
                            },
                        }),
                    })
                );
            },
        },
    };
}
