import type { SugarcubeConfig } from "@sugarcube-sh/core";

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
