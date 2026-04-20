import { isNoConfigError, loadInternalConfig } from "@sugarcube-sh/core";
import { resolve } from "pathe";
import { getProjectInfo } from "./framework.js";

function absolutePath(flagValue: string): string {
    return resolve(process.cwd(), flagValue);
}

export async function getCubeDir(flagValue: string | undefined): Promise<{ directory: string }> {
    if (flagValue) {
        return { directory: absolutePath(flagValue) };
    }

    try {
        const { config } = await loadInternalConfig();
        if (config.cube) {
            return { directory: absolutePath(config.cube) };
        }
    } catch (error) {
        if (!isNoConfigError(error)) {
            throw error;
        }
    }

    const { stylesDir } = getProjectInfo(process.cwd());
    return { directory: absolutePath(stylesDir) };
}

export async function getComponentsDir(
    flagValue: string | undefined
): Promise<{ directory: string }> {
    if (flagValue) {
        return { directory: absolutePath(flagValue) };
    }

    try {
        const { config } = await loadInternalConfig();
        return { directory: absolutePath(config.components ?? "components/ui") };
    } catch (error) {
        if (isNoConfigError(error)) {
            const { componentDir } = getProjectInfo(process.cwd());
            return { directory: absolutePath(componentDir) };
        }
        throw error;
    }
}
