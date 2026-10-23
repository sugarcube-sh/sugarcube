import { connectDevframe } from "devframe/client";
import type { Edits } from "@sugarcube-sh/dtcg-edit";
import type { StudioConnection } from "../host/open-studio";
import { pickSave } from "../host/save";
import { STUDIO_RPC } from "../studio-names";
import type { SaveOutcome, StudioConnectionConfig, StudioMessage } from "../protocol";

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

    const shared = await client.sharedState.get<StudioMessage>(STUDIO_RPC.MESSAGE);
    const config: StudioConnectionConfig = client.connectionMeta.configs?.[STUDIO_RPC.CONFIG] ?? {};
    const save = pickSave({
        live: client.connectionMeta.backend !== "static",
        call: (edits: Edits): Promise<SaveOutcome> => client.call(STUDIO_RPC.SAVE, edits),
        saveTo: config.saveTo,
    });
    return {
        ...(save && { save }),
        message: {
            value: () => shared.value() as unknown as StudioMessage | undefined,
            on: (event, listener) =>
                shared.on(event, (next) => listener(next as unknown as StudioMessage)),
        },
    };
}
