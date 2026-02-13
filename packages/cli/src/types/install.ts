import type { Framework, RegistryItem } from "./index.js";

export interface InstallComponentsOptions {
    registryIndex: RegistryItem[];
    selectedComponents: string[];
    componentType: Framework;
    componentsOutputDirectory: string;
    overwrite: boolean;
    packageManager: PackageManager;
}

export interface InstallComponentsResult {
    createdFiles: string[];
    npmDependencies: Set<string>;
}

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
