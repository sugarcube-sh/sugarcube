import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";
import { STUDIO_RPC } from "@sugarcube-sh/studio-protocol";
import { clientPath } from "@sugarcube-sh/studio/client";
import type { SugarcubePluginContext } from "@sugarcube-sh/vite";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import type { Plugin } from "vite";

const studioDockIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "../assets/sugarcube-logo.svg"),
        "utf8",
    ),
)}`;

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcSharedStates {
        [STUDIO_RPC.SHARED_STATE_WORKING]: { resolved: ResolvedTokens };
        [STUDIO_RPC.SHARED_STATE_DISK]: {
            config: InternalConfig;
            trees: TokenTree[];
            resolved: ResolvedTokens;
        };
    }
}

const SUGARCUBE_VITE_PLUGIN_NAME = "sugarcube:api";

export interface SugarcubeStudioOptions {
    /**
     * Host the built Studio SPA at `/__studio/`. Default `true`. Set `false`
     * when the host app serves that path itself (e.g. proxying `/__studio/`
     * to Studio's own Vite dev server for live HMR).
     */
    serveStatic?: boolean;
}

export default function sugarcubeStudio(options: SugarcubeStudioOptions = {}): Plugin {
    const { serveStatic = true } = options;
    return {
        name: "sugarcube:studio",

        devtools: {
            async setup(ctx) {
                if (serveStatic) {
                    ctx.views.hostStatic("/__studio/", clientPath);
                }

                ctx.docks.register({
                    id: "sugarcube-studio",
                    title: "Studio",
                    icon: studioDockIcon,
                    type: "iframe",
                    url: "/__studio/",
                });

                const sugarcubePlugin = ctx.viteConfig.plugins.find(
                    (p) => p.name === SUGARCUBE_VITE_PLUGIN_NAME,
                );
                const scCtx = sugarcubePlugin?.api?.getContext() as
                    | SugarcubePluginContext
                    | undefined;

                if (!scCtx) {
                    console.warn(
                        "[studio] Could not find sugarcube plugin context. Is @sugarcube-sh/vite installed?",
                    );
                    return;
                }

                await scCtx.ready;

                if (!scCtx.config || !scCtx.trees || !scCtx.resolved) {
                    console.warn(
                        "[studio] Sugarcube context resolved as ready but config/trees/resolved are missing. Skipping Studio setup.",
                    );
                    return;
                }

                const working = await ctx.rpc.sharedState.get(STUDIO_RPC.SHARED_STATE_WORKING, {
                    initialValue: { resolved: scCtx.resolved },
                });

                // Clone before publishing: the kit deep-freezes anything
                // assigned into shared state, and `loadTokens` mutates
                // `config.variables.permutations` in-place on every pipeline
                // run. Handing over the live reference would freeze it and
                // crash subsequent reloads.
                const disk = await ctx.rpc.sharedState.get(STUDIO_RPC.SHARED_STATE_DISK, {
                    initialValue: {
                        config: structuredClone(scCtx.config),
                        trees: scCtx.trees,
                        resolved: scCtx.resolved,
                    },
                });

                // The exact `resolved` object last synced into `working` by a disk
                // reload (see onReload). Used to tell a disk sync apart from a real
                // client edit in the "updated" handler below.
                let lastSyncedResolved: ResolvedTokens | null = null;

                working.on("updated", async () => {
                    const current = working.value();
                    if (!current?.resolved) return;

                    // A disk reload syncs `working.resolved` to the exact object
                    // sugarcube's own reloadTokens just produced. That update is not
                    // a client edit - the pipeline already ran and /__uno.css was
                    // already invalidated by the sugarcube plugin - so skip it.
                    // Without this, every disk token-save regenerates CSS and reloads
                    // /__uno.css twice.
                    if (current.resolved === lastSyncedResolved) return;

                    await scCtx.rerunPipeline(current.resolved);

                    if (ctx.viteServer) {
                        scCtx.invalidate(ctx.viteServer);
                    }
                });

                // Disk reload (file watcher, post-save, post-discard) →
                // push the new disk state to the client AND reset the
                // working copy to match).
                scCtx.onReload(() => {
                    if (!scCtx.config || !scCtx.resolved || !scCtx.trees) return;
                    const configClone = structuredClone(scCtx.config) as InternalConfig;
                    disk.mutate((draft) => {
                        draft.config = configClone;
                        draft.trees = scCtx.trees as TokenTree[];
                        draft.resolved = scCtx.resolved as ResolvedTokens;
                    });
                    // Remember the object we're syncing so the "updated" listener
                    // can recognise this as a disk sync, not a client edit.
                    lastSyncedResolved = scCtx.resolved as ResolvedTokens;
                    working.mutate((draft) => {
                        draft.resolved = scCtx.resolved as ResolvedTokens;
                    });
                });

                ctx.rpc.register(
                    defineRpcFunction({
                        name: STUDIO_RPC.SAVE,
                        type: "action",
                        setup: () => ({
                            handler: async (bundle) => {
                                for (const { path, edits } of bundle.files) {
                                    await scCtx.writeTokenEdits(path, edits);
                                }
                            },
                        }),
                    }),
                );

                ctx.rpc.register(
                    defineRpcFunction({
                        name: STUDIO_RPC.DISCARD,
                        type: "action",
                        setup: () => ({
                            handler: async () => {
                                // `onReload` writes fresh disk state into both shared states.
                                await scCtx.reloadTokens();
                                // Discard doesn't touch disk, so no token-watcher
                                // fires - invalidate here to push the reverted CSS to
                                // the page.
                                if (ctx.viteServer) {
                                    scCtx.invalidate(ctx.viteServer);
                                }
                            },
                        }),
                    }),
                );
            },
        },
    };
}
