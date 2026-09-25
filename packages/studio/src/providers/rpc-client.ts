import { connectDevframe } from "devframe/client";
import type { SharedState } from "devframe/utils/shared-state";
import type { SaveBundle } from "../host/types";
import { STUDIO_RPC, type StudioConnectionConfig } from "../protocol";
import type { StudioDiskState } from "../tokens/types";

export type DiskSharedStateHandle = SharedState<Partial<StudioDiskState>>;

export type StudioConnection = {
    transport: Awaited<ReturnType<typeof connectDevframe>>["transport"];
    config: StudioConnectionConfig;
    diskState: DiskSharedStateHandle;
    save: (bundle: SaveBundle) => Promise<void>;
};

/**
 * A devframe host (i.e. whichever dev server studio is running in) publishes `__connection.json`, which tells a client where to
 * open the RPC socket. Studio doesn't know which host mounted it, so it tries
 * its own URL first, then a level up. The env var covers `pnpm dev` in this
 * package, where the app sits at the root and the server answers at /__studio/.
 */
function connectionBases(): string[] {
    const here = new URL(".", window.location.href).href;
    const parent = new URL("..", here).href;
    const configured = import.meta.env.VITE_STUDIO_RPC_BASE;
    const bases = here === parent ? [here] : [here, parent];
    return configured ? [...bases, configured] : bases;
}

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
