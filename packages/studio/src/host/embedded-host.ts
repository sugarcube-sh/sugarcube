import { STUDIO_MESSAGE } from "@sugarcube-sh/studio-protocol";
import { createStore } from "zustand/vanilla";
import type { TokenSnapshot } from "../tokens/types";
import { attachEmbeddedPipeline } from "./embedded-pipeline";
import type { Host, SaveBundle, SaveResult } from "./types";

const SAVE_TIMEOUT_MS = 30_000;

export function createEmbeddedHost(signal: AbortSignal): Promise<Host> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }

        function listener(event: MessageEvent) {
            if (event.source !== window.parent) return;
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== STUDIO_MESSAGE.INIT || !isTokenSnapshot(data.snapshot)) return;
            cleanup();

            if (signal.aborted) {
                reject(new DOMException("Aborted", "AbortError"));
                return;
            }

            const snapshot: TokenSnapshot = data.snapshot;
            const baseline = createStore<TokenSnapshot>(() => snapshot);
            const parentOrigin = event.origin;

            resolve({
                baseline,
                working: undefined,
                attach: (store) => attachEmbeddedPipeline(store, snapshot, parentOrigin),
                save: (bundle) => embeddedSave(bundle, parentOrigin),
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

        // Bootstrap to '*'. We don't know the parent's origin yet; we'll capture it from init.
        window.parent.postMessage({ type: STUDIO_MESSAGE.READY }, "*");
    });
}

let nextSaveRequestId = 0;

function embeddedSave(bundle: SaveBundle, parentOrigin: string): Promise<SaveResult> {
    return new Promise((resolve) => {
        const requestId = String(++nextSaveRequestId);

        function handler(event: MessageEvent) {
            if (event.source !== window.parent) return;
            const data = event.data;
            if (!data || typeof data !== "object") return;
            if (data.type !== STUDIO_MESSAGE.SAVE_RESULT) return;
            if (data.requestId !== requestId) return;
            cleanup();

            if (typeof data.error === "string") {
                resolve({ kind: "failed", error: data.error });
            } else if (typeof data.number === "number" && typeof data.url === "string") {
                resolve({ kind: "pr-submitted", number: data.number, url: data.url });
            } else {
                resolve({ kind: "failed", error: "Malformed save result from host" });
            }
        }

        function cleanup() {
            window.removeEventListener("message", handler);
            clearTimeout(timer);
        }

        const timer = setTimeout(() => {
            cleanup();
            resolve({ kind: "failed", error: "Save timed out: host did not respond" });
        }, SAVE_TIMEOUT_MS);

        window.addEventListener("message", handler);
        window.parent.postMessage(
            {
                type: STUDIO_MESSAGE.SAVE,
                requestId,
                payload: {
                    title: bundle.title,
                    description: bundle.description,
                    files: bundle.files,
                },
            },
            parentOrigin
        );
    });
}

export function isTokenSnapshot(value: unknown): value is TokenSnapshot {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return "config" in obj && "trees" in obj && "resolved" in obj;
}
