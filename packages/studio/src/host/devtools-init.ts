/**
 * Init-time fetching for the DevTools Host. Pulls config + trees +
 * resolved via RPC, subscribes to both shared states, and waits for
 * them to populate before resolving — first-connect can race ahead
 * of the host registering its initial values.
 *
 * Returns the raw building blocks (`InitData`); the Host adapter wraps
 * them in the public Host shape.
 */

import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import {
    type DiskSharedStateHandle,
    type WorkingSharedStateHandle,
    getDiskSharedState,
    getWorkingSharedState,
    rpcGetTokens,
} from "../providers/rpc-client";

/**
 * Max time to wait for both shared states to populate. `rpcGetTokens()`
 * fails fast if the server is down — this timeout only covers the edge
 * case where RPC connects but shared state never arrives. The kit
 * doesn't expose a connection health signal, so a timeout is the best
 * we can do.
 */
const INIT_TIMEOUT_MS = 10_000;

export type InitData = {
    config: InternalConfig;
    trees: TokenTree[];
    diskResolved: ResolvedTokens;
    workingResolved: ResolvedTokens;
    diskState: DiskSharedStateHandle;
    workingState: WorkingSharedStateHandle;
};

export async function fetchInitData(signal: AbortSignal): Promise<InitData> {
    const [data, diskState, workingState] = await Promise.all([
        rpcGetTokens(),
        getDiskSharedState(),
        getWorkingSharedState(),
    ]);

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    await waitForSharedStates(diskState, workingState, signal);

    // Cast away the kit's ImmutableObject<T> wrapper at the boundary —
    // downstream consumers expect mutable types and don't actually mutate.
    const diskValue = diskState.value() as
        | { trees: TokenTree[]; resolved: ResolvedTokens }
        | undefined;
    const workingValue = workingState.value() as { resolved: ResolvedTokens } | undefined;

    return {
        config: data.config,
        trees: diskValue?.trees ?? data.trees,
        diskResolved: diskValue?.resolved ?? data.resolved,
        workingResolved: workingValue?.resolved ?? data.resolved,
        diskState,
        workingState,
    };
}

function waitForSharedStates(
    diskState: DiskSharedStateHandle,
    workingState: WorkingSharedStateHandle,
    signal: AbortSignal
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const isReady = () =>
            Boolean(diskState.value()?.resolved) &&
            Boolean(diskState.value()?.trees) &&
            Boolean(workingState.value()?.resolved);

        if (isReady()) {
            resolve();
            return;
        }

        const check = () => {
            if (!isReady()) return;
            unsubDisk();
            unsubWorking();
            clearTimeout(timer);
            resolve();
        };

        const unsubDisk = diskState.on("updated", check);
        const unsubWorking = workingState.on("updated", check);

        const timer = setTimeout(() => {
            unsubDisk();
            unsubWorking();
            reject(new Error("Timed out waiting for shared state"));
        }, INIT_TIMEOUT_MS);

        signal.addEventListener("abort", () => {
            unsubDisk();
            unsubWorking();
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        });
    });
}
