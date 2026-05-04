import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import { getDevToolsRpcClient } from "@vitejs/devtools-kit/client";
import type { SharedState } from "@vitejs/devtools-kit/utils/shared-state";
import type { SaveBundle } from "../host/types";

export type WorkingSharedState = { resolved: ResolvedTokens };
export type DiskSharedState = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

export type WorkingSharedStateHandle = SharedState<WorkingSharedState>;
export type DiskSharedStateHandle = SharedState<DiskSharedState>;

let rpc: Awaited<ReturnType<typeof getDevToolsRpcClient>> | null = null;

async function getRpc() {
    rpc ??= await getDevToolsRpcClient();
    return rpc;
}

/** Subscribe to the working-copy resolved state (mutated by client edits). */
export async function getWorkingSharedState(): Promise<WorkingSharedStateHandle> {
    const client = await getRpc();
    return client.sharedState.get("sugarcube:studio:working");
}

/**
 * Subscribe to the canonical disk state. Updated only by the host on
 * file watcher events, save, or discard. Emissions are the signal for
 * the client to refresh its baseline.
 */
export async function getDiskSharedState(): Promise<DiskSharedStateHandle> {
    const client = await getRpc();
    return client.sharedState.get("sugarcube:studio:disk");
}

// Persist the bundle's file edits. The SPA has already computed the
// diff; the server applies the edits as-given (no re-diff).
export async function rpcSave(bundle: SaveBundle): Promise<void> {
    const client = await getRpc();
    await client.call("studio:save", bundle);
}

export async function rpcDiscard(): Promise<void> {
    const client = await getRpc();
    await client.call("studio:discard");
}
