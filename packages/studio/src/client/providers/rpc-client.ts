import type { ResolvedTokens } from "@sugarcube-sh/core";
import { getDevToolsRpcClient } from "@vitejs/devtools-kit/client";
import type { SharedState } from "@vitejs/devtools-kit/utils/shared-state";

export type SharedResolvedState = {
    resolved: ResolvedTokens;
};

export type SharedStateHandle = SharedState<SharedResolvedState>;

let rpc: Awaited<ReturnType<typeof getDevToolsRpcClient>> | null = null;

async function getRpc() {
    rpc ??= await getDevToolsRpcClient();
    return rpc;
}

/** Fetch the static config + trees from the server. */
export async function rpcGetTokens() {
    const client = await getRpc();
    return client.call("studio:get-tokens");
}

/** Subscribe to the live resolved-tokens state. */
export async function getResolvedSharedState(): Promise<SharedStateHandle> {
    const client = await getRpc();
    return client.sharedState.get("sugarcube:studio:resolved");
}

/** Write staged edits from shared state to disk. */
export async function rpcSave(): Promise<void> {
    const client = await getRpc();
    await client.call("studio:save");
}

/** Discard staged edits and reload from disk. */
export async function rpcDiscard(): Promise<void> {
    const client = await getRpc();
    await client.call("studio:discard");
}
