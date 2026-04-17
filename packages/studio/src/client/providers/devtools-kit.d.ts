/// <reference types="@vitejs/devtools-kit" />

import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";

type TokenData = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

type SharedResolvedState = {
    resolved: ResolvedTokens;
};

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcServerFunctions {
        "studio:get-tokens": () => Promise<TokenData>;
        "studio:save": () => Promise<void>;
        "studio:discard": () => Promise<void>;
    }

    interface DevToolsRpcSharedStates {
        "sugarcube:studio:resolved": SharedResolvedState;
    }
}
