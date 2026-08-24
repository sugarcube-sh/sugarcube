import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import type { StoreApi } from "zustand";
import type { TokenStoreAPI } from "../store/create-token-store";
import type { FileEdits } from "../tokens/diff-to-edits";
import type { TokenSnapshot } from "../tokens/types";

export interface Host {
    /**
     * The canonical baseline. Read with `baseline.getState()`. Subscribe
     * via `baseline.subscribe(cb)` for change notifications. Embedded
     * fires once at init and never again. DevTools fires on every disk
     * change (file watcher, save, discard, external editor edit).
     */
    baseline: StoreApi<TokenSnapshot>;

    /**
     * Optional collaborative working channel. Present in DevTools - edits
     * flow through devtools shared state so the server can re-run the
     * pipeline and HMR the page. Absent in Embedded - edits are local
     * until save and the SPA runs the pipeline in-browser.
     */
    working?: WorkingChannel;

    /**
     * Optional hook for the host to attach mode-specific runtime
     * machinery to the token store. Embedded uses this to run the
     * pipeline in-browser and post the generated CSS to the parent
     * window. Returns a cleanup function for teardown. DevTools doesn't
     * implement it - the server runs the pipeline and HMR delivers CSS.
     */
    attach?(store: TokenStoreAPI): () => void;

    /**
     * Persist the diff. Return value is host-specific via the discriminated
     * SaveResult union. UI switches on `kind` to render the right notification.
     */
    save(bundle: SaveBundle): Promise<SaveResult>;

    /**
     * Discard the host-side working state. DevTools: reset the working
     * channel to match disk so the server pipeline output snaps back.
     * Embedded: no-op (no working channel exists). The SPA's local edit
     * stores are cleared by the SPA in parallel.
     */
    discard(): Promise<void>;

    capabilities: HostCapabilities;
}

export interface WorkingChannel {
    /** Synchronous read of the current working state. */
    get(): ResolvedTokens;
    /** Push the studio's current resolved state to the working channel. */
    push(resolved: ResolvedTokens): void;
    /** Subscribe to working-channel updates from elsewhere (e.g. other tabs, server pushes). */
    subscribe(callback: (resolved: ResolvedTokens) => void): () => void;
}

export interface SaveBundle {
    title: string;
    description: string;
    files: FileEdits[];
}

export type SaveResult =
    | { kind: "persisted" }
    | { kind: "pr-submitted"; number: number; url: string }
    | { kind: "failed"; error: string };

export interface HostCapabilities {
    saveLabel: string;
    discardLabel: string;
    requiresSaveMetadata: boolean;
}
