/**
 * Embedded mode Host — for the studio running inside a `<sugarcube-studio>`
 * web component iframe on a staging or preview deployment.
 *
 * Waits for the host page's `studio:init` postMessage, then returns a
 * Host whose baseline is the received snapshot. There is no working
 * channel — edits stay in the SPA's stores until save, and the in-browser
 * pipeline (EmbeddedPipelineRunner) generates CSS for the host page.
 *
 * Save round-trips via postMessage: posts `studio:save` with a request id
 * and waits for `studio:save-result` carrying the matching id and the
 * PR result (or error). The id correlation prevents one save's response
 * from accidentally resolving another's promise.
 *
 * Discard is a no-op at the host level — there's no host-side state to
 * reset. The SPA clears its own edit stores in parallel.
 */

import { createStore } from "zustand/vanilla";
import type { TokenSnapshot } from "../tokens/types";
import type { Host, SaveBundle, SaveResult } from "./types";

/**
 * Build an Embedded Host. Resolves once the host page's `studio:init`
 * arrives. Honours `signal.abort()` so the studio:init listener doesn't
 * leak if the iframe unmounts mid-handshake.
 */
export function createEmbeddedHost(signal: AbortSignal): Promise<Host> {
    return new Promise((resolve, reject) => {
        function listener(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== "studio:init" || !isTokenSnapshot(data.snapshot)) return;
            cleanup();

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

        function onAbort() {
            cleanup();
            reject(new DOMException("Aborted", "AbortError"));
        }

        function cleanup() {
            window.removeEventListener("message", listener);
            signal.removeEventListener("abort", onAbort);
        }

        window.addEventListener("message", listener);
        signal.addEventListener("abort", onAbort);

        // "*" targetOrigin is intentional — Studio can be embedded on any
        // origin (localhost, staging, preview deploys). The handshake
        // contains only CSS and token data, not credentials.
        window.parent.postMessage({ type: "studio:ready" }, "*");
    });
}

let nextSaveRequestId = 0;

function embeddedSave(bundle: SaveBundle): Promise<SaveResult> {
    return new Promise((resolve) => {
        const requestId = String(++nextSaveRequestId);

        function handler(event: MessageEvent) {
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== "studio:save-result") return;
            // Ignore responses for any other in-flight save. The host
            // echoes back the requestId we sent so we can correlate.
            if (data.requestId !== requestId) return;
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
                requestId,
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
