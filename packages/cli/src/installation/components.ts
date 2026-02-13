import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "pathe";
import { getRegistryFiles } from "../registry/client.js";
import {
    CLIError,
    type InstallComponentsOptions,
    type InstallComponentsResult,
    type RegistryItem,
} from "../types/index.js";
import { resolveTree } from "../utils/resolve-dependencies.js";
import { installDependencies } from "./dependencies.js";

interface RegistryFileWithContent {
    path: string;
    content: string;
}

async function writeComponentFile(
    file: RegistryFileWithContent,
    component: RegistryItem,
    componentsOutputDirectory: string
): Promise<string | null> {
    const componentDir = join(componentsOutputDirectory, component.name);
    await mkdir(componentDir, { recursive: true });

    if (file.path.endsWith(".css")) {
        const cssFilePath = join(componentDir, `${component.name}.css`);
        await writeFile(cssFilePath, file.content);
        return cssFilePath;
    }

    const filePath = join(componentDir, basename(file.path));
    await writeFile(filePath, file.content);
    return filePath;
}

export async function installComponents({
    registryIndex,
    selectedComponents,
    componentType,
    componentsOutputDirectory,
    packageManager,
}: InstallComponentsOptions): Promise<InstallComponentsResult> {
    const createdFiles: string[] = [];
    const npmDeps = new Set<string>();

    await mkdir(componentsOutputDirectory, { recursive: true });

    const tree = await resolveTree(registryIndex, selectedComponents, componentType);

    for (const component of tree) {
        const result = await getRegistryFiles({
            type: "component",
            name: component.name,
            framework: componentType,
        });

        for (const file of result.files) {
            if (!file) continue;

            try {
                const filePath = await writeComponentFile(
                    file,
                    component,
                    componentsOutputDirectory
                );
                if (filePath) {
                    createdFiles.push(filePath);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? `: ${error.message}` : "";
                throw new CLIError(
                    `Failed to write component file for "${component.name}"${errorMessage}`
                );
            }
        }

        const frameworkDeps = component.dependencies?.[componentType] || [];
        for (const d of frameworkDeps) {
            npmDeps.add(d);
        }
    }

    if (npmDeps.size > 0) {
        try {
            await installDependencies(Array.from(npmDeps), process.cwd(), packageManager);
        } catch (error) {
            const errorMessage = error instanceof Error ? `: ${error.message}` : "";
            throw new CLIError(`Failed to install component dependencies${errorMessage}`);
        }
    }

    return { createdFiles, npmDependencies: npmDeps };
}
