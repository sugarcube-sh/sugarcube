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
 * Discard is a no-op at the host level: there's no host-side state to
 * reset. The SPA clears its own edit stores in parallel.
 */

import { createStore } from "zustand/vanilla";
import type { TokenSnapshot } from "../tokens/types";
import type { Host, SaveBundle, SaveResult } from "./types";

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
                discard: async () => {},
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

        // TODO: We should only allow messages from the same origin.
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
