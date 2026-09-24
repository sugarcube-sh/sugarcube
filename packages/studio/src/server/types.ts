import type {
    InternalConfig,
    Permutation,
    ResolvedTokens,
    TokenSources,
    TokenTree,
} from "@sugarcube-sh/core/client";
import type { SaveBundle } from "../host/types";
import type { StudioConnectionConfig } from "../protocol";
import type { StudioDiskState } from "../tokens/types";
import type { FileOps } from "../tokens/write-ops";

export type { StudioDiskState };

/** What the client sends to save: the edits performed, replayed against each file as it is on disk (D-043). */
export type StudioSaveBundle = SaveBundle;

/**
 * What Studio needs from any host: the files as they are on disk, a way to
 * write operations back, and a way to re-read.
 */
export interface StudioTokenSource {
    ready: Promise<void>;
    config: InternalConfig | null;
    trees: TokenTree[] | null;
    resolved: ResolvedTokens | null;
    defaultContext: string | null;
    permutations: Permutation[];
    sources: TokenSources | null;
    /** Why the last load produced less than it should have, one sentence each. */
    errors?: readonly string[];
    /** All or nothing: a rename touches several files, and half a rename leaves
     * dangling references. */
    writeOps(files: FileOps[]): Promise<void>;
    reloadTokens(): Promise<void>;
    onReload(fn: () => void): void;
}

export interface StudioSharedState<T extends object> {
    mutate(fn: (draft: T) => void): void;
}

export interface StudioSurface {
    id: string;
    title: string;
    route: string;
}

export interface StudioHostBridge {
    sharedState<T extends object>(key: string, initialValue: T): Promise<StudioSharedState<T>>;
    registerAction<Args extends unknown[]>(
        name: string,
        handler: (...args: Args) => Promise<void>,
    ): void;
    warn(message: string): void;
    /** Publish Studio's block of the connection handshake, read-only for every client. */
    publishConfig?(config: StudioConnectionConfig): void;
}

export interface DefineStudioOptions {
    /** Where a save goes from a build with no server: a service that opens a pull request. */
    saveUrl?: string;
}
