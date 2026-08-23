import { createStore } from "zustand/vanilla";
import type { TokenSnapshot } from "../tokens/types";
import type { Host } from "./types";

/**
 * Lets you develop Studio from this package alone (`pnpm dev`) — no www,
 * no DevTools. Loads Studio's own tokens so the UI can render.
 */
export async function createSandboxHost(signal: AbortSignal): Promise<Host> {
    const url = `${import.meta.env.BASE_URL}snapshot.json`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
        throw new Error(
            `Snapshot endpoint ${url} returned ${res.status}. ` +
                "Is the sugarcube plugin resolving tokens?",
        );
    }

    const snapshot = (await res.json()) as TokenSnapshot;

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const baseline = createStore<TokenSnapshot>(() => snapshot);

    return {
        baseline,
        working: undefined,
        save: async () => ({
            kind: "failed",
            error: "Saving is disabled in the Studio sandbox (pnpm dev).",
        }),
        discard: async () => {},
        capabilities: {
            saveLabel: "Save",
            discardLabel: "Discard",
            requiresSaveMetadata: false,
        },
    };
}
