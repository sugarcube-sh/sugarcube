import type { StoreApi } from "zustand";
import type { TokenStoreAPI } from "../store/create-source-store";
import type { FileOps, WriteOp } from "../tokens/write-ops";
import type { TokenSnapshot } from "../tokens/types";

export interface Host {
    /** Disk, as the host last saw it. Moves whenever disk does; nothing copies it, everything reads it. */
    baseline: StoreApi<TokenSnapshot>;

    /** Unsaved operations that outlived a reload of the page the dock sits on. */
    restore?: readonly WriteOp[];

    /** Called whenever the unsaved operations change, so a host can keep them. */
    persist(ops: readonly WriteOp[]): void;

    /** Opens the channel that carries the working CSS to the page Studio is docked on. Returns the teardown. */
    attach(store: TokenStoreAPI): () => void;

    /** The edits, to the server that holds the files or to the service that opens a pull request. */
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
