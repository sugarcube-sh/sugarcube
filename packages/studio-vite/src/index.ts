/// <reference types="@vitejs/devtools-kit" />

import type { ResolvedTokens, TokenTree } from "@sugarcube-sh/core";
import { clientPath } from "@sugarcube-sh/studio/client";
import type { SugarcubePluginContext } from "@sugarcube-sh/vite";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import type { Plugin } from "vite";

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcSharedStates {
        /** Working copy — mutated by client edits, watched by host to re-run pipeline. */
        "sugarcube:studio:working": { resolved: ResolvedTokens };
        /**
         * Canonical disk state — updated only by `scCtx.onReload`. Carries
         * `trees` so the client can refresh its baseline (recipes live on
         * group nodes in trees, not in resolved).
         */
        "sugarcube:studio:disk": { trees: TokenTree[]; resolved: ResolvedTokens };
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

                const working = await ctx.rpc.sharedState.get("sugarcube:studio:working", {
                    initialValue: { resolved: scCtx.resolved },
                });

                const disk = await ctx.rpc.sharedState.get("sugarcube:studio:disk", {
                    initialValue: { trees: scCtx.trees, resolved: scCtx.resolved },
                });

                // Client edit → re-run pipeline + push CSS via HMR.
                working.on("updated", async () => {
                    const current = working.value();
                    if (!current?.resolved) return;

                    await scCtx.rerunPipeline(current.resolved);

                    if (ctx.viteServer) {
                        scCtx.invalidate(ctx.viteServer);
                    }
                });

                // Disk reload (file watcher, post-save, post-discard) →
                // push the new disk state to the client AND reset the
                // working copy to match (preserves today's "external file
                // edit blows away pending edits" semantics).
                scCtx.onReload(() => {
                    if (!scCtx.resolved || !scCtx.trees) return;
                    disk.mutate((draft) => {
                        draft.trees = scCtx.trees as TokenTree[];
                        draft.resolved = scCtx.resolved as ResolvedTokens;
                    });
                    working.mutate((draft) => {
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
                            handler: async (bundle) => {
                                // The SPA computed the diff and packaged it
                                // — apply the file edits as-given. What the
                                // diff panel shows is what gets written.
                                for (const { path, edits } of bundle.files) {
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
                                // `onReload` writes fresh disk state into both shared states.
                                await scCtx.reloadTokens();
                            },
                        }),
                    })
                );
            },
        },
    };
}
