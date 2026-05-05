/// <reference types="@vitejs/devtools-kit" />

import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import type { SaveBundle } from "../host/types";

type WorkingState = {
    resolved: ResolvedTokens;
};

type DiskState = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

declare module "@vitejs/devtools-kit" {
    interface DevToolsRpcServerFunctions {
        "studio:save": (bundle: SaveBundle) => Promise<void>;
        "studio:discard": () => Promise<void>;
    }

    interface DevToolsRpcSharedStates {
        "sugarcube:studio:working": WorkingState;
        "sugarcube:studio:disk": DiskState;
    }
}
