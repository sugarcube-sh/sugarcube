import type { SugarcubeConfig } from "@sugarcube-sh/core";
import type { VarRef } from "../lint/scan-css.js";
import type { UnreadStylesheets } from "../scan-project.js";

export interface LintOptions {
    ignore?: string;
    fallback?: "error" | "warn" | "off";
    json?: boolean;
}

export interface ScanOutput {
    broken: VarRef[];
    fallback: VarRef[];
    refCount: number;
    scannedFiles: number;
    unread: UnreadStylesheets[];
}

export interface InitOptions {
    tokens?: string;
    cube?: string;
    components?: string;
}

export interface InitContext {
    options: InitOptions;
    tokensDir: string;
    hasExistingTokens: boolean;
    starterKit: string | null;
    sugarcubeConfig: SugarcubeConfig;
    createdFiles: string[];
}
