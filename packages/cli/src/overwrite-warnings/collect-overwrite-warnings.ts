import { existsSync } from "node:fs";
import { join, relative } from "pathe";
import { getComponentFilePath } from "../installation/components.js";
import { getRegistryIndex, selectFiles } from "../registry/client.js";
import type { OverwriteWarnings } from "../types/overwrite-warnings.js";
import type { Framework, RegistryItem } from "../types/registry.js";

export function collectComponentOverwriteWarnings({
    tree,
    framework,
    componentsOutputDirectory,
}: {
    tree: RegistryItem[];
    framework: Framework;
    componentsOutputDirectory: string;
}): OverwriteWarnings {
    const paths = tree.flatMap((component) =>
        selectFiles(component, framework).map((file) =>
            getComponentFilePath(component, file.path, componentsOutputDirectory),
        ),
    );
    return {
        variableCSS: [],
        utilityCSS: [],
        componentFiles: paths.filter(existsSync).map((path) => relative(process.cwd(), path)),
        componentCSS: [],
        cubeCSS: [],
        indexFiles: [],
    };
}

export async function collectCubeOverwriteWarnings({
    cubeDirectory,
}: {
    cubeDirectory: string;
}): Promise<OverwriteWarnings> {
    const warnings: OverwriteWarnings = {
        variableCSS: [],
        utilityCSS: [],
        componentFiles: [],
        componentCSS: [],
        cubeCSS: [],
        indexFiles: [],
    };

    const registryIndex = await getRegistryIndex();

    const cubeCSSFiles = registryIndex
        .filter((item): item is RegistryItem & { type: "cube" } => item.type === "cube")
        .flatMap((item) => item.files)
        .map((file) => {
            const relativePath = file.path.replace(/^styles\//, "");
            return relative(process.cwd(), join(cubeDirectory, relativePath));
        });

    warnings.cubeCSS = cubeCSSFiles.filter((file) => existsSync(join(process.cwd(), file)));

    return warnings;
}
