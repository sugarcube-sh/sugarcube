import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";
import { type ReactNode, useEffect, useState } from "react";
import { type StoreApi, createStore } from "zustand";
import type { TokenStoreState } from "../store/create-token-store";
import { StudioContext } from "../store/hooks";
import { createScaleState } from "../store/scale-state";
import { PathIndex } from "../tokens/path-index";
import type { TokenSnapshot } from "../tokens/types";
import {
    type SharedStateHandle,
    getResolvedSharedState,
    rpcDiscard,
    rpcGetTokens,
} from "./rpc-client";

/**
 * Max time to wait for the DevTools shared state to populate on first connect.
 * If the server is fully down, `rpcGetTokens()` fails immediately — this
 * timeout only covers the edge case where the RPC connection succeeds but
 * the shared state never arrives (e.g. server-side init bug). The DevTools
 * kit doesn't expose a connection health signal, so a timeout is the best
 * we can do.
 */
const INIT_TIMEOUT_MS = 10_000;

type InitData = {
    config: InternalConfig;
    trees: TokenTree[];
    sharedState: SharedStateHandle;
    /** Disk state — the canonical baseline for diffs and Discard. */
    diskResolved: ResolvedTokens;
    /** Shared state — the working copy, may contain unsaved edits. */
    workingResolved: ResolvedTokens;
};

async function fetchInitData(signal: AbortSignal): Promise<InitData> {
    const [data, sharedState] = await Promise.all([rpcGetTokens(), getResolvedSharedState()]);

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // The shared state may not have synced from the server yet on first connect.
    // Wait for a valid value before returning, with a timeout.
    let state = sharedState.value();
    if (!state?.resolved) {
        await new Promise<void>((resolve, reject) => {
            const unsub = sharedState.on("updated", () => {
                if (sharedState.value()?.resolved) {
                    unsub();
                    clearTimeout(timer);
                    resolve();
                }
            });

            const timer = setTimeout(() => {
                unsub();
                reject(new Error("Timed out waiting for shared state"));
            }, INIT_TIMEOUT_MS);

            signal.addEventListener("abort", () => {
                unsub();
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
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

    useEffect(function connectToDevTools() {
        const controller = new AbortController();

        fetchInitData(controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setInitData(data);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "Failed to connect");
            });

        return () => controller.abort();
    }, []);

    if (error) {
        return (
            <div className="studio-error">
                <p>Failed to connect to the dev server.</p>
                <p>Make sure your Vite dev server is running and try reloading.</p>
                <details>
                    <summary>Details</summary>
                    <pre>{error}</pre>
                </details>
            </div>
        );
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

    const [studioCtx] = useState(() => {
        const snapshot: TokenSnapshot = {
            formatVersion: 1,
            generatedAt: "",
            sourceConfigPath: "",
            config,
            trees,
            resolved: diskResolved,
        };

        // PathIndex is built from DISK state — the canonical baseline.
        // This is what diffs compare against and what Discard reverts to.
        const pathIndex = new PathIndex(snapshot);

        // Store starts with the WORKING copy (shared state) which may
        // already contain edits from a previous dock session.
        const initialContext = pathIndex.contexts[0] ?? "default";

        const store = createStore<TokenStoreState>((set, get) => ({
            resolved: workingResolved,
            css: null,
            isComputing: false,
            error: null,
            lastRunMs: null,

            currentContext: initialContext,
            setCurrentContext: (ctx) => set({ currentContext: ctx }),

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
                const ctx = get().currentContext;
                sharedState.mutate((draft) => {
                    const entries = pathIndex.entriesFor(path).filter((e) => e.context === ctx);
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
            snapshot,
            pathIndex,
            store,
            (nextResolved) => {
                const current = store.getState().resolved;
                sharedState.mutate((draft) => {
                    for (const [key, token] of Object.entries(nextResolved)) {
                        if (!token || !("$value" in token)) continue;
                        const original = current[key];
                        if (!original || !("$value" in original)) continue;
                        if (JSON.stringify(token) !== JSON.stringify(original)) {
                            draft.resolved[key] = token as ResolvedTokens[string];
                        }
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
    });

    // Subscribe to shared state updates and push into the zustand store.
    // Valid useEffect: subscribing to an external system (DevTools shared state).
    useEffect(
        function syncSharedState() {
            const unsubscribe = sharedState.on("updated", (newState) => {
                studioCtx.store.setState({ resolved: newState.resolved });
            });
            return unsubscribe;
        },
        [sharedState, studioCtx.store]
    );

    return <StudioContext.Provider value={studioCtx}>{children}</StudioContext.Provider>;
}
