import type { GitSaveSettings, StudioConnectionConfig } from "../protocol";

export interface StudioSharedState<T extends object> {
    mutate(fn: (draft: T) => void): void;
}

export interface StudioSurface {
    readonly id: string;
    readonly title: string;
    readonly route: string;
}

export interface StudioHostBridge {
    sharedState<T extends object>(key: string, initialValue: T): Promise<StudioSharedState<T>>;
    registerAction<Args extends unknown[]>(
        name: string,
        handler: (...args: Args) => Promise<unknown>,
    ): void;
    warn(message: string): void;
    /** Writes values into the `__connection.json` a client fetches when it
     * connects, so they reach the client once, at startup, and never come back. */
    publishConfig?(config: StudioConnectionConfig): void;
}

export interface DefineStudioOptions {
    gitSave?: GitSaveSettings | undefined;
}
