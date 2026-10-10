import type { SugarcubeConfig } from "@sugarcube-sh/core";

export interface LintOptions {
    ignore?: string;
    fallback?: "error" | "warn" | "off";
    json?: boolean;
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
