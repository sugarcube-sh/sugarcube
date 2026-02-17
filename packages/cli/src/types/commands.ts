import type {
    InternalConfig,
    ResolvedTokens,
    SugarcubeConfig,
    TokenTree,
    userConfigSchema,
} from "@sugarcube-sh/core";
import type { z } from "zod";
import type { Framework as ProjectFramework } from "../detection/framework.js";
import type { Task } from "../prompts/tasks.js";
import type { PackageManager } from "./index.js";

interface FileInfo {
    path: string;
    content: string;
}

export interface SetupResult {
    trees: TokenTree[];
    resolved: ResolvedTokens;
    tokensDir: string;
    tokenFiles: FileInfo[];
    createdTokenPaths: string[];
    config: z.infer<typeof userConfigSchema>;
}

interface CreatedFiles {
    generated: string[];
}

export interface InitOptions {
    kit?: string;
    tokensDir?: string;
    stylesDir?: string;
    variablesDir?: string;
    variablesFilename?: string;
    utilitiesDir?: string;
    utilitiesFilename?: string;
    fluidMin?: string;
    fluidMax?: string;
    colorFallback?: string;
    skipDeps?: boolean;
}

export interface InitContext {
    options: InitOptions;
    tokensDir: string;
    stylesDir: string;
    isSrcDir: boolean;
    config: InternalConfig;
    sugarcubeConfig: SugarcubeConfig;
    hasExistingTokens: boolean;
    starterKit: string | null;
    pluginToInstall: string | null;
    cliToInstall: string | null;
    setupResult?: SetupResult;
    createdFiles: string[];
    installedDependencies: string[];
    createdDirectories: string[];
    tasks: Task[];
    packageManager: PackageManager;
}

export interface ProjectContext {
    tokensDir: string;
    stylesDir: string;
    isSrcDir: boolean;
    hasExistingTokens: boolean;
    resolverPath: string | null;
    framework: ProjectFramework;
}

export interface InstallationTargets {
    starterKit: string | null;
    pluginToInstall: string | null;
    cliToInstall: string | null;
}

export type TypeSource = "@sugarcube-sh/vite" | "@sugarcube-sh/cli" | null;
