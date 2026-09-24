import { connectDevframe } from "devframe/client";
import type { SharedState } from "devframe/utils/shared-state";
import type { SaveBundle } from "../host/types";
import { STUDIO_RPC, type StudioConnectionConfig } from "../protocol";
import type { StudioDiskState } from "../tokens/types";

export type DiskSharedStateHandle = SharedState<Partial<StudioDiskState>>;

export type StudioConnection = {
    transport: Awaited<ReturnType<typeof connectDevframe>>["transport"];
    /** What the host baked into the handshake for Studio. */
    config: StudioConnectionConfig;
    diskState: DiskSharedStateHandle;
    save: (bundle: SaveBundle) => Promise<void>;
};

/**
 * Where the descriptor can be: under Studio itself, under whatever mounted it
 * (a hub, a dock), and, in this package's own dev server, where the bridge is.
 */
function connectionBases(): string[] {
    const here = new URL(".", window.location.href).href;
    const parent = new URL("..", here).href;
    const configured = import.meta.env.VITE_STUDIO_RPC_BASE;
    const bases = here === parent ? [here] : [here, parent];
    return configured ? [...bases, configured] : bases;
}

/**
 * One connection, owned by whoever holds the signal: closed when it aborts,
 * and never shared with a second mount, so React's double effect opens one
 * socket and closes the one it abandoned.
 */
export async function connectStudio(signal: AbortSignal): Promise<StudioConnection> {
    const client = await connectDevframe({ baseURL: connectionBases() });
    if (signal.aborted) {
        client.close?.();
        throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", () => client.close?.(), { once: true });

    return {
        transport: client.transport,
        config: client.connectionMeta.configs?.[STUDIO_RPC.CONFIG] ?? {},
        diskState: await client.sharedState.get<Partial<StudioDiskState>>(
            STUDIO_RPC.SHARED_STATE_DISK,
        ),
        save: async (bundle) => {
            await client.call(STUDIO_RPC.SAVE, bundle);
        },
    };
}
