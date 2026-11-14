import type { GitSaveSettings, StudioConnectionConfig } from "../protocol";

export interface StudioSharedState<T extends object> {
    mutate(fn: (draft: T) => void): void;
}

export interface StudioDock {
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
    publishConfig?(config: StudioConnectionConfig): void;
}

export interface SetupStudioOptions {
    gitSave?: GitSaveSettings | undefined;
}
