import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "pathe";
import { CLIError } from "../cli-error.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { getRegistryFiles, getRegistryIndex } from "../registry/client.js";

function isWithinDirectory(filePath: string, directory: string): boolean {
    const resolvedPath = resolve(filePath);
    const resolvedDir = resolve(directory);
    const relativePath = relative(resolvedDir, resolvedPath);
    return !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

export async function installCUBE(cssOutputDirectory: string) {
    const createdFiles: string[] = [];
    const stylesDir = resolve(process.cwd(), cssOutputDirectory);

    await mkdir(stylesDir, { recursive: true });

    const registryIndex = await getRegistryIndex();
    const cubeModules = registryIndex
        .filter((entry) => entry.type === "cube")
        .map((entry) => entry.name);

    for (const module of cubeModules) {
        const result = await getRegistryFiles({ type: "cube", name: module });

        for (const file of result.files) {
            if (!file) continue;

            const relativePath = file.path.replace(/^styles\//, "");
            const filePath = resolve(stylesDir, relativePath);

            if (!isWithinDirectory(filePath, stylesDir)) {
                throw new CLIError(ErrorMessages.CUBE_PATH_ESCAPES(module));
            }

            const fileDir = dirname(filePath);

            try {
                await mkdir(fileDir, { recursive: true });
                await writeFile(filePath, file.content);
                createdFiles.push(filePath);
            } catch (error) {
                throw new CLIError(ErrorMessages.CUBE_WRITE_FAILED(module, error));
            }
        }
    }

    return createdFiles;
}
