import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type StoreApi, createStore } from "zustand";
import { PathIndex } from "../../store/path-index";
import type { TokenStoreState } from "../store/create-token-store";
import { StudioContext } from "../store/hooks";
import { createScaleState } from "../store/scale-state";
import {
    type SharedStateHandle,
    getResolvedSharedState,
    rpcDiscard,
    rpcGetTokens,
} from "./rpc-client";

type InitData = {
    config: InternalConfig;
    trees: TokenTree[];
    sharedState: SharedStateHandle;
    /** Disk state — the canonical baseline for diffs and Discard. */
    diskResolved: ResolvedTokens;
    /** Shared state — the working copy, may contain unsaved edits. */
    workingResolved: ResolvedTokens;
};

async function fetchInitData(): Promise<InitData> {
    const [data, sharedState] = await Promise.all([rpcGetTokens(), getResolvedSharedState()]);

    // The shared state may not have synced from the server yet on first connect.
    // Wait for a valid value before returning.
    let state = sharedState.value();
    if (!state?.resolved) {
        await new Promise<void>((resolve) => {
            const unsub = sharedState.on("updated", () => {
                if (sharedState.value()?.resolved) {
                    unsub();
                    resolve();
                }
            });
        });
        state = sharedState.value();
    }

    return {
        config: data.config,
        trees: data.trees,
        sharedState,
        diskResolved: data.resolved,
        workingResolved: state.resolved,
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
        return <div>Failed to load Studio: {error}</div>;
    }

    if (!initData) {
        return <div>Loading Studio...</div>;
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
    const { config, trees, sharedState, diskResolved, workingResolved } = initData;

    const studioCtx = useMemo(() => {
        // PathIndex is built from DISK state — the canonical baseline.
        // This is what diffs compare against and what Discard reverts to.
        const pathIndex = new PathIndex({
            formatVersion: 1,
            generatedAt: "",
            sourceConfigPath: "",
            config,
            trees,
            resolved: diskResolved,
        });

        // Store starts with the WORKING copy (shared state) which may
        // already contain edits from a previous dock session.
        const store = createStore<TokenStoreState>((_, get) => ({
            resolved: workingResolved,
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

            resetToken: (path) => {
                sharedState.mutate((draft) => {
                    const entries = pathIndex.entriesFor(path);
                    for (const entry of entries) {
                        const originalToken = diskResolved[entry.key];
                        if (!originalToken || !("$value" in originalToken)) continue;
                        const draftToken = draft.resolved[entry.key];
                        if (draftToken && "$value" in draftToken) {
                            (draftToken as { $value: unknown }).$value = (
                                originalToken as { $value: unknown }
                            ).$value;
                        }
                    }
                });
            },

            resetAll: () => {
                rpcDiscard();
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
                resolved: diskResolved,
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
    }, [config, trees, sharedState, diskResolved, workingResolved]);

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
