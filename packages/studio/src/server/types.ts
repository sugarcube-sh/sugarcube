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

export type StudioSaveBundle = SaveBundle;

/**
 * Studio never reads token files itself. Under Vite the sugarcube plugin hands
 * over tokens it has already parsed; the standalone Node server parses them on
 * its own. This is what those two have to look like from studio's side.
 */
export interface StudioTokenSource {
    ready: Promise<void>;
    config: InternalConfig | null;
    trees: TokenTree[] | null;
    resolved: ResolvedTokens | null;
    defaultContext: string | null;
    permutations: Permutation[];
    sources: TokenSources | null;
    errors?: readonly string[];
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
    /** Writes values into the `__connection.json` a client fetches when it
     * connects, so they reach the client once, at startup, and never come back. */
    publishConfig?(config: StudioConnectionConfig): void;
}

export interface DefineStudioOptions {
    saveUrl?: string;
}
