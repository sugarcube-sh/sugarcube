/// <reference types="@vitejs/devtools-kit" />

import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";

type TokenData = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

type WorkingState = {
    resolved: ResolvedTokens;
};

type DiskState = {
    trees: TokenTree[];
    resolved: ResolvedTokens;
    version: number;
};

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcServerFunctions {
        "studio:get-tokens": () => Promise<TokenData>;
        "studio:save": () => Promise<void>;
        "studio:discard": () => Promise<void>;
    }

    interface DevToolsRpcSharedStates {
        "sugarcube:studio:working": WorkingState;
        "sugarcube:studio:disk": DiskState;
    }
}
