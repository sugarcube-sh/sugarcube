import type { LoadedConfig } from "@sugarcube-sh/core";
import type { AnyDiagnostic } from "@sugarcube-sh/core/client";
import type { DesignTokens } from "@sugarcube-sh/dtcg";

export interface FilesSnapshot {
    readonly config: LoadedConfig["config"];
    readonly tokens: DesignTokens;
    readonly configProblems: readonly AnyDiagnostic[];
}

export interface StudioFiles {
    getSnapshot(): FilesSnapshot;
    onChange(listener: () => void): () => void;
}
