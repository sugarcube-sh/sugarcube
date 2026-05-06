/**
 * Init-time fetching for the DevTools Host. Subscribes to both shared
 * states and waits for them to populate before resolving — first-connect
 * can race ahead of the host registering its initial values.
 *
 * Returns the raw building blocks (`InitData`); the Host adapter wraps
 * them in the public Host shape.
 */

import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import {
    type DiskSharedState,
    type DiskSharedStateHandle,
    type WorkingSharedState,
    type WorkingSharedStateHandle,
    getDiskSharedState,
    getWorkingSharedState,
} from "../providers/rpc-client";

/**
 * Max time to wait for both shared states to populate. Covers the edge
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
    const [diskState, workingState] = await Promise.all([
        getDiskSharedState(),
        getWorkingSharedState(),
    ]);

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    await waitForSharedStates(diskState, workingState, signal);

    const diskValue = diskState.value() as DiskSharedState | undefined;
    const workingValue = workingState.value() as WorkingSharedState | undefined;

    if (!diskValue || !workingValue) {
        throw new Error("Shared state ready but values missing");
    }

    return {
        config: diskValue.config,
        trees: diskValue.trees,
        diskResolved: diskValue.resolved,
        workingResolved: workingValue.resolved,
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
        const isReady = () => {
            const disk = diskState.value();
            return Boolean(
                disk?.config && disk?.trees && disk?.resolved && workingState.value()?.resolved
            );
        };

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
