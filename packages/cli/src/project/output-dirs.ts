import { isNoConfigError, loadInternalConfig } from "@sugarcube-sh/core";
import { resolve } from "pathe";
import { getProjectInfo } from "./framework.js";

function toAbsolutePath(flagValue: string): string {
    return resolve(process.cwd(), flagValue);
}

export async function getCubeDir(flagValue: string | undefined): Promise<{ directory: string }> {
    if (flagValue) {
        return { directory: toAbsolutePath(flagValue) };
    }

    try {
        const { config } = await loadInternalConfig();
        if (config.cube) {
            return { directory: toAbsolutePath(config.cube) };
        }
    } catch (error) {
        if (!isNoConfigError(error)) {
            throw error;
        }
    }

    const { stylesDir } = getProjectInfo(process.cwd());
    return { directory: toAbsolutePath(stylesDir) };
}

export async function getComponentsDir(
    flagValue: string | undefined,
): Promise<{ directory: string }> {
    if (flagValue) {
        return { directory: toAbsolutePath(flagValue) };
    }

    try {
        const { config } = await loadInternalConfig();
        return { directory: toAbsolutePath(config.components ?? "components/ui") };
    } catch (error) {
        if (isNoConfigError(error)) {
            const { componentDir } = getProjectInfo(process.cwd());
            return { directory: toAbsolutePath(componentDir) };
        }
        throw error;
    }
}
