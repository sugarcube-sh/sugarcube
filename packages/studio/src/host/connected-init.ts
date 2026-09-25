import type { DiskSharedStateHandle } from "../providers/rpc-client";
import type { StudioDiskState, TokenSnapshot } from "../tokens/types";

const INIT_TIMEOUT_MS = 10_000;

export function snapshotFromDisk(disk: Partial<StudioDiskState>): TokenSnapshot | null {
    const { config, trees, resolved, sources } = disk;
    if (!config || !trees || !resolved || !sources) return null;
    return {
        config,
        trees,
        resolved,
        defaultContext: disk.defaultContext ?? null,
        permutations: disk.permutations ?? [],
        sources,
    };
}

export async function fetchInitData(
    diskState: DiskSharedStateHandle,
    signal: AbortSignal,
): Promise<TokenSnapshot> {
    await waitForSharedState(diskState, signal);

    const snapshot = snapshotFromDisk(diskState.value() as Partial<StudioDiskState>);
    if (!snapshot) {
        throw new Error("The host sent no token files. Studio needs the files to edit them.");
    }
    return snapshot;
}

type SharedStateLike = {
    value(): unknown;
    on(event: "updated", listener: (value: unknown) => void): () => void;
};

export function waitForSharedState(
    diskState: SharedStateLike,
    signal: AbortSignal,
    timeoutMs = INIT_TIMEOUT_MS,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const isReady = () => {
            const disk = diskState.value() as Partial<StudioDiskState> | undefined;
            return Boolean(disk?.config && disk?.trees && disk?.resolved);
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
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
        }

        const unsubDisk = diskState.on("updated", check);
        const timer = setTimeout(onTimeout, timeoutMs);
        signal.addEventListener("abort", onAbort);
    });
}
