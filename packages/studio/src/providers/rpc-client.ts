import type { ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import { getDevToolsRpcClient } from "@vitejs/devtools-kit/client";
import type { SharedState } from "@vitejs/devtools-kit/utils/shared-state";

export type WorkingSharedState = { resolved: ResolvedTokens };
export type DiskSharedState = { trees: TokenTree[]; resolved: ResolvedTokens; version: number };

export type WorkingSharedStateHandle = SharedState<WorkingSharedState>;
export type DiskSharedStateHandle = SharedState<DiskSharedState>;

let rpc: Awaited<ReturnType<typeof getDevToolsRpcClient>> | null = null;

async function getRpc() {
    rpc ??= await getDevToolsRpcClient();
    return rpc;
}

// Fetch the static config + trees from the server. Used at init for
// `config` (which doesn't change at runtime); trees + resolved are
// also delivered live via the disk shared state.
export async function rpcGetTokens() {
    const client = await getRpc();
    return client.call("studio:get-tokens");
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

// Write staged edits from the working state to disk.
export async function rpcSave(): Promise<void> {
    const client = await getRpc();
    await client.call("studio:save");
}

// Discard staged edits and reload from disk.
export async function rpcDiscard(): Promise<void> {
    const client = await getRpc();
    await client.call("studio:discard");
}
