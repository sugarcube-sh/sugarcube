import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type StoreApi, createStore } from "zustand";
import { PathIndex } from "../../store/path-index";
import type { TokenStoreState } from "../store/create-token-store";
import { StudioContext } from "../store/hooks";
import { createScaleState } from "../store/scale-state";

type SharedResolvedState = {
    resolved: ResolvedTokens;
};

type SharedStateHandle = {
    value: () => SharedResolvedState;
    mutate: (fn: (draft: SharedResolvedState) => void) => void;
    on: (event: "updated", fn: (state: SharedResolvedState) => void) => () => void;
};

type RpcCallFn = (method: string, ...args: unknown[]) => Promise<unknown>;

type InitData = {
    config: InternalConfig;
    trees: TokenTree[];
    sharedState: SharedStateHandle;
    initialResolved: ResolvedTokens;
};

async function fetchInitData(): Promise<InitData> {
    const { getDevToolsRpcClient } = await import("@vitejs/devtools-kit/client");
    const client = await getDevToolsRpcClient();

    const rpcCall = (client as { call: RpcCallFn }).call.bind(client);
    const data = (await rpcCall("studio:get-tokens")) as {
        config: InternalConfig;
        trees: TokenTree[];
    };

    const sharedState = await (
        client as {
            sharedState: { get: (name: string) => Promise<SharedStateHandle> };
        }
    ).sharedState.get("sugarcube:studio:resolved");

    return {
        config: data.config,
        trees: data.trees,
        sharedState,
        initialResolved: sharedState.value().resolved,
    };
}

export function DevToolsTokenProvider({ children }: { children: ReactNode }) {
    const [initData, setInitData] = useState<InitData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchInitData()
            .then(setInitData)
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to connect");
            });
    }, []);

    if (error) {
        return <div className="studio-error">Failed to load Studio: {error}</div>;
    }

    if (!initData) {
        return <div className="studio-loading">Loading Studio...</div>;
    }

    return <DevToolsProviderInner initData={initData}>{children}</DevToolsProviderInner>;
}

function DevToolsProviderInner({
    initData,
    children,
}: {
    initData: InitData;
    children: ReactNode;
}) {
    const { config, trees, sharedState, initialResolved } = initData;

    const studioCtx = useMemo(() => {
        const pathIndex = new PathIndex({
            formatVersion: 1,
            generatedAt: "",
            sourceConfigPath: "",
            config,
            trees,
            resolved: initialResolved,
        });

        const store = createStore<TokenStoreState>((_, get) => ({
            resolved: initialResolved,
            css: null,
            isComputing: false,
            error: null,
            lastRunMs: null,

            getToken: (path, context) => pathIndex.readValue(get().resolved, path, context),

            setToken: (path, value, context) => {
                sharedState.mutate((draft) => {
                    const entries = context
                        ? pathIndex.entriesFor(path).filter((e) => e.context === context)
                        : pathIndex.entriesFor(path);
                    for (const entry of entries) {
                        const token = draft.resolved[entry.key];
                        if (token && "$value" in token) {
                            (token as { $value: unknown }).$value = value;
                        }
                    }
                });
            },

            setTokens: (updates) => {
                sharedState.mutate((draft) => {
                    for (const { path, value, context } of updates) {
                        const entries = context
                            ? pathIndex.entriesFor(path).filter((e) => e.context === context)
                            : pathIndex.entriesFor(path);
                        for (const entry of entries) {
                            const token = draft.resolved[entry.key];
                            if (token && "$value" in token) {
                                (token as { $value: unknown }).$value = value;
                            }
                        }
                    }
                });
            },

            resetToken: () => {},

            resetAll: async () => {
                const { getDevToolsRpcClient } = await import("@vitejs/devtools-kit/client");
                const client = await getDevToolsRpcClient();
                await (client as { call: RpcCallFn }).call("studio:discard");
            },
        })) as StoreApi<TokenStoreState>;

        const scaleState = createScaleState(
            config.studio?.panel ?? [],
            {
                formatVersion: 1,
                generatedAt: "",
                sourceConfigPath: "",
                config,
                trees,
                resolved: initialResolved,
            },
            pathIndex,
            store,
            (changes) => {
                sharedState.mutate((draft) => {
                    for (const { key, token } of changes) {
                        draft.resolved[key] = token as ResolvedTokens[string];
                    }
                });
            }
        );

        return {
            mode: "devtools" as const,
            store,
            pathIndex,
            scaleState,
            studioConfig: config.studio,
        };
    }, [config, trees, sharedState, initialResolved]);

    // Subscribe to shared state updates and push directly into the zustand store.
    // This is a valid useEffect: subscribing to an external system (DevTools shared state).
    useEffect(() => {
        const unsubscribe = sharedState.on("updated", (newState) => {
            studioCtx.store.setState({ resolved: newState.resolved });
        });
        return unsubscribe;
    }, [sharedState, studioCtx.store]);

    return <StudioContext.Provider value={studioCtx}>{children}</StudioContext.Provider>;
}
