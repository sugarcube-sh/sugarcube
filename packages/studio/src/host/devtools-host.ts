/**
 * DevTools mode Host — wraps the Vite plugin's RPC + shared-state surface.
 *
 * Two shared states underpin the model:
 *   - disk: canonical on-disk state, updated by the host's file watcher
 *     / save / discard handlers. Drives baseline reactivity.
 *   - working: the user's pending working copy, watched by the host to
 *     re-run the pipeline and HMR the page.
 *
 * Save writes the diff to disk via `jsonc-parser`. Discard tells the
 * server to re-read disk; the resulting onReload pushes new state into
 * both shared states, which propagates back to baseline + working.
 */

import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import { createStore } from "zustand/vanilla";
import { rpcDiscard, rpcSave } from "../providers/rpc-client";
import type { TokenSnapshot } from "../tokens/types";
import { type InitData, fetchInitData } from "./devtools-init";
import type { Host } from "./types";

/**
 * Build a DevTools Host. Subscribes to the disk channel so every disk
 * emission rebuilds the baseline snapshot — downstream consumers
 * (computeDiff, recipe selectors, scale captures) see the new on-disk
 * state without needing to remount.
 */
export async function createDevToolsHost(signal: AbortSignal): Promise<Host> {
    const initData = await fetchInitData(signal);

    const buildSnapshot = (
        config: InternalConfig,
        trees: TokenTree[],
        resolved: ResolvedTokens
    ): TokenSnapshot => ({
        formatVersion: 1,
        generatedAt: "",
        sourceConfigPath: "",
        config,
        trees,
        resolved,
    });

    const baseline = createStore<TokenSnapshot>(() =>
        buildSnapshot(initData.config, initData.trees, initData.diskResolved)
    );

    initData.diskState.on("updated", (next) => {
        baseline.setState(
            buildSnapshot(
                next.config as InternalConfig,
                next.trees as TokenTree[],
                next.resolved as ResolvedTokens
            )
        );
    });

    return {
        baseline,
        working: workingChannelFor(initData),
        save: async (bundle) => {
            // Send the SPA-computed bundle to the server, which applies
            // bundle.files to disk as-is. Server doesn't re-diff —
            // what the diff panel shows is exactly what gets written.
            try {
                await rpcSave(bundle);
                return { kind: "persisted" };
            } catch (err) {
                return { kind: "failed", error: err instanceof Error ? err.message : String(err) };
            }
        },
        discard: async () => {
            // Server re-reads disk and pushes new state into both shared
            // states. The disk subscription updates baseline; the working
            // subscription (in createTokenStore) updates the store's resolved.
            await rpcDiscard();
        },
        capabilities: {
            saveLabel: "Save",
            discardLabel: "Discard",
            requiresSaveMetadata: false,
        },
    };
}

function workingChannelFor(initData: InitData): NonNullable<Host["working"]> {
    return {
        get: () =>
            (initData.workingState.value()?.resolved as ResolvedTokens | undefined) ??
            initData.workingResolved,
        push: (resolved) => {
            initData.workingState.mutate((draft) => {
                draft.resolved = resolved;
            });
        },
        subscribe: (cb) =>
            initData.workingState.on("updated", (next) => cb(next.resolved as ResolvedTokens)),
    };
}
