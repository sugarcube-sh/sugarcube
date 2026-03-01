import type { SugarcubeConfig } from "@sugarcube-sh/core";

export interface InitOptions {
    kit?: string;
    tokensDir?: string;
    cube?: boolean;
    components?: boolean;
    vite?: boolean;
}

export interface InitContext {
    options: InitOptions;
    tokensDir: string;
    hasExistingTokens: boolean;
    starterKit: string | null;
    sugarcubeConfig: SugarcubeConfig;
    createdFiles: string[];
}
