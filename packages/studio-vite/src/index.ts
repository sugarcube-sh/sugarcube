/// <reference types="@vitejs/devtools-kit" />

import type { ResolvedTokens } from "@sugarcube-sh/core";
import { PathIndex, type TokenSnapshot, computeDiff, diffToFileEdits } from "@sugarcube-sh/studio";
import { clientPath } from "@sugarcube-sh/studio/client";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import sirv from "sirv";
import type { Plugin } from "vite";

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcSharedStates {
        "sugarcube:studio:resolved": { resolved: ResolvedTokens };
    }
}

export default function sugarcubeStudio(): Plugin {
    return {
        name: "sugarcube:studio",

        // Serve the Studio client at /__studio/ for embedded mode in dev.
        // DevTools mode uses ctx.views.hostStatic() instead (inside the
        // devtools hook below), but embedded mode needs a standard Vite
        // middleware since it runs outside the DevTools dock.
        configureServer(server) {
            server.middlewares.use("/__studio/", sirv(clientPath, { dev: true, single: true }));
        },

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
                    (p) => p.name === "sugarcube:api"
                );
                const scCtx = sugarcubePlugin?.api?.getContext();

                if (!scCtx) {
                    console.warn(
                        "[studio] Could not find sugarcube plugin context. Is @sugarcube-sh/vite installed?"
                    );
                    return;
                }

                await scCtx.ready;

                // ── Shared state ──
                // Only `resolved` lives in shared state — it's the thing the
                // client mutates. Config and trees are static during a session
                // and fetched via RPC at init time.
                const state = await ctx.rpc.sharedState.get("sugarcube:studio:resolved", {
                    initialValue: {
                        resolved: scCtx.resolved,
                    },
                });

                // When shared state is mutated (client editing tokens),
                // re-run the pipeline and push CSS via HMR.
                state.on("updated", async () => {
                    const current = state.value();
                    if (!current?.resolved) return;

                    await scCtx.rerunPipeline(current.resolved as ResolvedTokens);

                    if (ctx.viteServer) {
                        scCtx.invalidate(ctx.viteServer);
                    }
                });

                // When tokens reload from disk (file watcher or explicit reload),
                // update the shared state so the client sees the new data.
                scCtx.onReload(() => {
                    state.mutate((draft) => {
                        draft.resolved = scCtx.resolved as typeof draft.resolved;
                    });
                });

                // ── RPC: get static data (config + trees) ──
                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:get-tokens",
                        type: "query",
                        setup: () => ({
                            handler: async () => {
                                await scCtx.ready;
                                return {
                                    config: scCtx.config,
                                    trees: scCtx.trees,
                                    resolved: scCtx.resolved,
                                };
                            },
                        }),
                    })
                );

                // ── RPC: save staged edits to disk ──
                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:save",
                        type: "action",
                        setup: () => ({
                            handler: async () => {
                                const current = state.value();
                                const baseline = scCtx.resolved;
                                if (!current?.resolved || !baseline) return;

                                const snapshot: TokenSnapshot = {
                                    formatVersion: 1,
                                    generatedAt: new Date().toISOString(),
                                    sourceConfigPath: "",
                                    config: scCtx.config,
                                    trees: scCtx.trees,
                                    resolved: baseline,
                                };
                                const pathIndex = new PathIndex(snapshot);
                                const diff = computeDiff(current.resolved, baseline, pathIndex);
                                const fileEdits = diffToFileEdits(diff);

                                for (const { path, edits } of fileEdits) {
                                    await scCtx.writeTokenEdits(path, edits);
                                }
                            },
                        }),
                    })
                );

                // ── RPC: discard staged edits ──
                ctx.rpc.register(
                    defineRpcFunction({
                        name: "studio:discard",
                        type: "action",
                        setup: () => ({
                            handler: async () => {
                                await scCtx.reloadTokens();
                                // onReload callback updates shared state
                            },
                        }),
                    })
                );
            },
        },
    };
}
