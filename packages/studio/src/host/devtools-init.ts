import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import {
    type DiskSharedState,
    type DiskSharedStateHandle,
    type WorkingSharedState,
    type WorkingSharedStateHandle,
    getDiskSharedState,
    getWorkingSharedState,
} from "../providers/rpc-client";

// Max wait for both shared states to populate — the kit has no connection-health signal.
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
    signal: AbortSignal,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }

        const isReady = () => {
            const disk = diskState.value();
            return Boolean(
                disk?.config && disk?.trees && disk?.resolved && workingState.value()?.resolved,
            );
        };

        if (isReady()) {
            resolve();
            return;
        }

        function check() {
            if (!isReady()) return;
            cleanup();
            resolve();
        }

        function onAbort() {
            cleanup();
            reject(new DOMException("Aborted", "AbortError"));
        }

        function onTimeout() {
            cleanup();
            reject(new Error("Timed out waiting for shared state"));
        }

        function cleanup() {
            unsubDisk();
            unsubWorking();
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
        }

        const unsubDisk = diskState.on("updated", check);
        const unsubWorking = workingState.on("updated", check);
        const timer = setTimeout(onTimeout, INIT_TIMEOUT_MS);
        signal.addEventListener("abort", onAbort);
    });
}
