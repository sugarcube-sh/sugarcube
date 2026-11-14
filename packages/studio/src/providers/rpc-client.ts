import { connectDevframe } from "devframe/client";
import type { Edits } from "@sugarcube-sh/dtcg-edit";
import type { StudioConnection } from "../host/open-studio";
import { createBrowserPage } from "../host/browser-page";
import { pickSave } from "../host/save";
import { STUDIO_RPC } from "../studio-names";
import type { SaveResult, StudioConnectionConfig, StudioMessage } from "../protocol";

function getConnectionBases(): string[] {
    const ownURL = new URL(".", window.location.href).href;
    const parentURL = new URL("..", ownURL).href;
    const configuredBase = import.meta.env.VITE_STUDIO_RPC_BASE;
    const bases = ownURL === parentURL ? [ownURL] : [ownURL, parentURL];
    return configuredBase ? [...bases, configuredBase] : bases;
}

export async function connectStudio(signal: AbortSignal): Promise<StudioConnection> {
    const client = await connectDevframe({ baseURL: getConnectionBases() });
    if (signal.aborted) {
        client.close?.();
        throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", () => client.close?.(), { once: true });

    const sharedMessage = await client.sharedState.get<StudioMessage>(STUDIO_RPC.MESSAGE);
    const config: StudioConnectionConfig = client.connectionMeta.configs?.[STUDIO_RPC.CONFIG] ?? {};
    const { save, signIn } = pickSave({
        live: client.connectionMeta.backend !== "static",
        saveOnHost: (edits: Edits): Promise<SaveResult> => client.call(STUDIO_RPC.SAVE, edits),
        gitSave: config.gitSave,
        page: createBrowserPage(),
    });
    return {
        ...(save && { save }),
        ...(signIn && { signIn }),
        message: {
            value: () => sharedMessage.value() as StudioMessage | undefined,
            on: (event, listener) =>
                sharedMessage.on(event, (next) => listener(next as StudioMessage)),
        },
    };
}
