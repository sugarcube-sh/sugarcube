import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";

type TokenData = {
    config: InternalConfig;
    trees: TokenTree[];
};

export type SharedResolvedState = {
    resolved: ResolvedTokens;
};

export type SharedStateHandle = {
    value: () => SharedResolvedState;
    mutate: (fn: (draft: SharedResolvedState) => void) => void;
    on: (event: "updated", fn: (state: SharedResolvedState) => void) => () => void;
};

type RpcCallFn = (method: string, ...args: unknown[]) => Promise<unknown>;

type DevToolsClient = {
    call: RpcCallFn;
    sharedState: { get: (name: string) => Promise<SharedStateHandle> };
};

let cachedClient: DevToolsClient | null = null;

async function getClient(): Promise<DevToolsClient> {
    if (cachedClient) return cachedClient;
    const { getDevToolsRpcClient } = await import("@vitejs/devtools-kit/client");
    cachedClient = (await getDevToolsRpcClient()) as unknown as DevToolsClient;
    return cachedClient;
}

/** Fetch the static config + trees from the server. */
export async function rpcGetTokens(): Promise<TokenData> {
    const client = await getClient();
    return (await client.call("studio:get-tokens")) as TokenData;
}

/** Subscribe to the live resolved-tokens state. */
export async function getResolvedSharedState(): Promise<SharedStateHandle> {
    const client = await getClient();
    return client.sharedState.get("sugarcube:studio:resolved");
}

/** Write staged edits from shared state to disk. */
export async function rpcSave(): Promise<void> {
    const client = await getClient();
    await client.call("studio:save");
}

/** Discard staged edits and reload from disk. */
export async function rpcDiscard(): Promise<void> {
    const client = await getClient();
    await client.call("studio:discard");
}
