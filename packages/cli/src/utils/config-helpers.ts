import { isNoConfigError, loadInternalConfig } from "@sugarcube-sh/core";
import { getProjectInfo } from "../detection/framework.js";
import { resolveDirectoryFromFlag } from "./directory-resolver.js";

export async function getCubeDir(flagValue: string | undefined): Promise<{ directory: string }> {
    if (flagValue) {
        const { absolute } = resolveDirectoryFromFlag(flagValue);
        return { directory: absolute };
    }

    try {
        const { config } = await loadInternalConfig();
        const cubeDir = config.output.cube || config.output.cssRoot;
        const { absolute } = resolveDirectoryFromFlag(cubeDir);
        return { directory: absolute };
    } catch (error) {
        if (isNoConfigError(error)) {
            const { stylesDir } = getProjectInfo(process.cwd());
            const { absolute } = resolveDirectoryFromFlag(stylesDir);
            return { directory: absolute };
        }
        throw error;
    }
}

export async function getComponentsDir(
    flagValue: string | undefined
): Promise<{ directory: string }> {
    if (flagValue) {
        const { absolute } = resolveDirectoryFromFlag(flagValue);
        return { directory: absolute };
    }

    try {
        const { config } = await loadInternalConfig();
        const { absolute } = resolveDirectoryFromFlag(config.output.components ?? "components/ui");
        return { directory: absolute };
    } catch (error) {
        if (isNoConfigError(error)) {
            const { componentDir } = getProjectInfo(process.cwd());
            const { absolute } = resolveDirectoryFromFlag(componentDir);
            return { directory: absolute };
        }
        throw error;
    }
}
