import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "pathe";
import { CLIError } from "../cli-error.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { getItemFiles } from "../registry/client.js";
import type { Framework, RegistryItem } from "../types/registry.js";

export function getComponentFilePath(
    component: RegistryItem,
    registryPath: string,
    componentsOutputDirectory: string,
): string {
    const fileName = registryPath.endsWith(".css")
        ? `${component.name}.css`
        : basename(registryPath);
    return join(componentsOutputDirectory, component.name, fileName);
}

export async function writeComponentFiles(
    component: RegistryItem,
    framework: Framework,
    componentsOutputDirectory: string,
): Promise<void> {
    const files = await getItemFiles(component, framework);
    try {
        await mkdir(join(componentsOutputDirectory, component.name), { recursive: true });
        for (const file of files) {
            const path = getComponentFilePath(component, file.path, componentsOutputDirectory);
            await writeFile(path, file.content);
        }
    } catch (error) {
        throw new CLIError(ErrorMessages.COMPONENT_WRITE_FAILED(component.name, error));
    }
}
