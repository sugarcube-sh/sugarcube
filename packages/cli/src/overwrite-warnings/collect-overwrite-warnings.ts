import { existsSync } from "node:fs";
import { join, relative } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import { getComponentFilePath } from "../installation/components.js";
import { printWarning } from "../prompts/box-with-badge.js";
import { confirmOverwrite } from "../prompts/prompts.js";
import { getRegistryIndex, selectFiles } from "../registry/client.js";
import type { Framework, RegistryItem } from "../types/registry.js";

export function findComponentFilesToOverwrite({
    components,
    framework,
    componentsOutputDirectory,
}: {
    components: RegistryItem[];
    framework: Framework;
    componentsOutputDirectory: string;
}): string[] {
    const componentFilePaths = components.flatMap((component) =>
        selectFiles(component, framework).map((file) =>
            getComponentFilePath(component, file.path, componentsOutputDirectory),
        ),
    );
    return componentFilePaths.filter(existsSync).map((path) => relative(process.cwd(), path));
}

export async function findCubeFilesToOverwrite(cubeDirectory: string): Promise<string[]> {
    const registryIndex = await getRegistryIndex();
    return registryIndex
        .filter((item) => item.type === "cube")
        .flatMap((item) => item.files)
        .map((file) => join(cubeDirectory, file.path.replace(/^styles\//, "")))
        .filter(existsSync)
        .map((path) => relative(process.cwd(), path));
}

export async function confirmOverwriting(
    kind: "component" | "cube",
    files: string[],
    options: { force?: boolean; silent?: boolean; continueOnDecline?: boolean },
): Promise<boolean> {
    if (files.length === 0 || options.force || options.silent) return true;
    printWarning(ErrorMessages.FILES_WILL_BE_OVERWRITTEN(kind, files), { plain: false });
    return confirmOverwrite("Continue?", false, { exitOnDecline: !options.continueOnDecline });
}
