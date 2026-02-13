import { existsSync } from "node:fs";
import { join, relative } from "pathe";
import { getRegistryIndex } from "../registry/client.js";
import {
    CLIError,
    type ComponentFile,
    type Framework,
    type OverwriteWarnings,
    type RegistryItem,
} from "../types/index.js";
import { resolveTree } from "../utils/resolve-dependencies.js";

export async function collectComponentOverwriteWarnings({
    selectedComponents,
    componentType,
    componentsOutputDirectory,
}: {
    selectedComponents: string[];
    componentType: Framework;
    componentsOutputDirectory: string;
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

    const tree = await resolveTree(registryIndex, selectedComponents, componentType);
    const allComponents = tree.map((item: RegistryItem) => item.name);

    const componentRegistryItems = registryIndex
        .filter((item): item is RegistryItem & { type: "component" } => item.type === "component")
        .filter((item) => allComponents.includes(item.name));

    const componentFiles = componentRegistryItems.flatMap((item) =>
        item.files
            .filter(
                (file): file is ComponentFile =>
                    (file.type === "tsx" || file.type === "astro" || file.type === "njk") &&
                    "framework" in file &&
                    file.framework === componentType
            )
            .map((file) => {
                return relative(
                    process.cwd(),
                    join(componentsOutputDirectory, item.name, `${item.name}.${file.type}`)
                );
            })
    );

    warnings.componentFiles = componentFiles.filter((file) => {
        const exists = existsSync(join(process.cwd(), file));
        return exists;
    });

    // All component files (CSS) go to component directory
    const componentCSSFiles = componentRegistryItems.map((item) => {
        const componentName = item.name;
        return relative(
            process.cwd(),
            join(componentsOutputDirectory, item.name, `${componentName}.css`)
        );
    });

    warnings.componentCSS = componentCSSFiles.filter((file) => {
        const exists = existsSync(join(process.cwd(), file));
        return exists;
    });

    return warnings;
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
