import type { StoreApi } from "zustand";
import type { TokenStoreAPI } from "../store/create-source-store";
import type { FileOps, WriteOp } from "../tokens/write-ops";
import type { TokenSnapshot } from "../tokens/types";

export interface Host {
    baseline: StoreApi<TokenSnapshot>;

    /** Unsaved edits that survived a reload of the page the dock sits on. */
    restore?: readonly WriteOp[];

    /** Called on every edit, not just on save. */
    persist(ops: readonly WriteOp[]): void;

    /** Streams the edited CSS to the page so it previews live. Returns a detach. */
    attach(store: TokenStoreAPI): () => void;

    save(bundle: SaveBundle): Promise<SaveResult>;

    capabilities: HostCapabilities;
}

export interface SaveBundle {
    title: string;
    description: string;
    files: FileOps[];
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
