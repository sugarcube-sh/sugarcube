/// <reference types="@vitejs/devtools-kit" />

import { fileURLToPath } from "node:url";
import type { ResolvedTokens } from "@sugarcube-sh/core";
import { defineRpcFunction } from "@vitejs/devtools-kit";
import type { Plugin } from "vite";

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcSharedStates {
        "sugarcube:studio:resolved": { resolved: ResolvedTokens };
    }
}

const clientPath = fileURLToPath(new URL("./client", import.meta.url));

/**
 * Given a resolved token, build the JSON edits needed to update its
 * source file surgically via jsonc-parser.
 */
function buildTokenEdits(
    tokenPath: string,
    newToken: Record<string, unknown>
): Array<{ jsonPath: string[]; value: unknown }> {
    const segments = tokenPath.split(".");
    const edits: Array<{ jsonPath: string[]; value: unknown }> = [];

    if ("$value" in newToken) {
        edits.push({ jsonPath: [...segments, "$value"], value: newToken.$value });
    }

    const extensions = newToken.$extensions as Record<string, unknown> | undefined;
    const sugarcube = extensions?.["sh.sugarcube"] as Record<string, unknown> | undefined;
    if (sugarcube?.fluid) {
        edits.push({
            jsonPath: [...segments, "$extensions", "sh.sugarcube", "fluid"],
            value: sugarcube.fluid,
        });
    }

    return edits;
}

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

                                // Diff shared state against disk state
                                const byFile = new Map<
                                    string,
                                    Array<{ jsonPath: string[]; value: unknown }>
                                >();

                                for (const [key, token] of Object.entries(current.resolved)) {
                                    const original = baseline[key];
                                    if (!token || !original) continue;
                                    if (!("$value" in token) || !("$value" in original)) continue;
                                    if (JSON.stringify(token) === JSON.stringify(original))
                                        continue;

                                    const t = token as {
                                        $path: string;
                                        $source: { sourcePath: string };
                                    };
                                    const edits = buildTokenEdits(
                                        t.$path,
                                        token as Record<string, unknown>
                                    );

                                    const existing = byFile.get(t.$source.sourcePath);
                                    if (existing) {
                                        existing.push(...edits);
                                    } else {
                                        byFile.set(t.$source.sourcePath, edits);
                                    }
                                }

                                for (const [sourcePath, edits] of byFile) {
                                    await scCtx.writeTokenEdits(sourcePath, edits);
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
