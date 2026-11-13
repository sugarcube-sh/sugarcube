import type { LoadedConfig } from "@sugarcube-sh/core";
import type { AnyDiagnostic } from "@sugarcube-sh/core/client";
import type { DesignTokens } from "@sugarcube-sh/dtcg";

export interface FilesNow {
    readonly config: LoadedConfig["config"];
    readonly tokens: DesignTokens;
    readonly configProblems: readonly AnyDiagnostic[];
}

export interface StudioFiles {
    now(): FilesNow;
    onChange(listener: () => void): () => void;
}
