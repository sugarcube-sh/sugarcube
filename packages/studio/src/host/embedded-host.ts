/**
 * Embedded mode Host — for the studio running inside a `<sugarcube-studio>`
 * web component iframe on a staging or preview deployment.
 *
 * Waits for the host page's `studio:init` postMessage, then returns a
 * Host whose baseline is the received snapshot. There is no working
 * channel — edits stay in the SPA's stores until save, and the in-browser
 * pipeline (EmbeddedPipelineRunner) generates CSS for the host page.
 *
 * Save round-trips via postMessage: posts `studio:save` to the parent
 * and waits for `studio:save-result` carrying the PR result (or error).
 * Discard is a no-op at the host level — there's no host-side state to
 * reset. The SPA clears its own edit stores in parallel.
 */

import { createStore } from "zustand/vanilla";
import type { TokenSnapshot } from "../tokens/types";
import type { Host, SaveBundle, SaveResult } from "./types";
/** Build an Embedded Host. Resolves once the host page's `studio:init` arrives. */
export function createEmbeddedHost(): Promise<Host> {
    return new Promise((resolve) => {
        function listener(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== "studio:init" || !isTokenSnapshot(data.snapshot)) return;
            window.removeEventListener("message", listener);

            const baseline = createStore<TokenSnapshot>(() => data.snapshot);

            resolve({
                baseline,
                working: undefined,
                save: embeddedSave,
                discard: async () => {
                    // No host-side state to reset. The SPA's edit-state
                    // clearing happens in parallel in DesignActions.
                },
                capabilities: {
                    saveLabel: "Submit as PR",
                    discardLabel: "Discard",
                    requiresSaveMetadata: true,
                },
            });
        }

        window.addEventListener("message", listener);
        // "*" targetOrigin is intentional — Studio can be embedded on any
        // origin (localhost, staging, preview deploys). The handshake
        // contains only CSS and token data, not credentials.
        window.parent.postMessage({ type: "studio:ready" }, "*");
    });
}

function embeddedSave(bundle: SaveBundle): Promise<SaveResult> {
    return new Promise((resolve) => {
        function handler(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== "studio:save-result") return;
            window.removeEventListener("message", handler);

            if (typeof data.error === "string") {
                resolve({ kind: "failed", error: data.error });
            } else if (typeof data.number === "number" && typeof data.url === "string") {
                resolve({ kind: "pr-submitted", number: data.number, url: data.url });
            } else {
                resolve({ kind: "failed", error: "Malformed save result from host" });
            }
        }

        window.addEventListener("message", handler);
        window.parent.postMessage(
            {
                type: "studio:save",
                payload: {
                    title: bundle.title,
                    description: bundle.description,
                    files: bundle.files,
                },
            },
            "*"
        );
    });
}

function isTokenSnapshot(value: unknown): value is TokenSnapshot {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return "config" in obj && "trees" in obj && "resolved" in obj;
}
