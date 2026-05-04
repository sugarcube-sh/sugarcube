import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import { createStore } from "zustand/vanilla";
import { rpcDiscard, rpcSave } from "../providers/rpc-client";
import type { TokenSnapshot } from "../tokens/types";
import { type InitData, fetchInitData } from "./devtools-init";
import type { Host } from "./types";

/**
 * Build a DevTools Host. Subscribes to the disk channel so every disk
 * emission rebuilds the baseline snapshot. Downstream consumers
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
            try {
                await rpcSave(bundle);
                return { kind: "persisted" };
            } catch (err) {
                return { kind: "failed", error: err instanceof Error ? err.message : String(err) };
            }
        },
        discard: async () => {
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
