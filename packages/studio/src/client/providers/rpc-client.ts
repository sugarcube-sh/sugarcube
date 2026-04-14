import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";

type TokenState = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

type RpcCallFn = (method: string, ...args: unknown[]) => Promise<unknown>;

let rpcCall: RpcCallFn | null = null;

async function getRpc(): Promise<RpcCallFn> {
    if (rpcCall) return rpcCall;
    const { getDevToolsRpcClient } = await import("@vitejs/devtools-kit/client");
    const client = await getDevToolsRpcClient();
    rpcCall = (client as { call: RpcCallFn }).call.bind(client);
    return rpcCall;
}

export async function rpcGetTokens(): Promise<TokenState> {
    const call = await getRpc();
    return (await call("studio:get-tokens")) as TokenState;
}

export async function rpcSetToken(key: string, newToken: Record<string, unknown>): Promise<void> {
    const call = await getRpc();
    await call("studio:set-token", { key, newToken });
}

export async function rpcSetTokens(
    updates: Array<{ key: string; newToken: Record<string, unknown> }>
): Promise<void> {
    const call = await getRpc();
    await call("studio:set-tokens", { updates });
}

export async function rpcResetAll(): Promise<TokenState> {
    const call = await getRpc();
    return (await call("studio:reset-all")) as TokenState;
}
