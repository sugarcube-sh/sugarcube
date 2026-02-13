import { isNoConfigError, loadInternalConfig } from "@sugarcube-sh/core";
import { resolveDirectoryFromFlag } from "./directory-resolver.js";

// NOTE: Current logic for both cube and components commands is to preference the flag value over the config file.
export async function getCubeDir(flagValue: string | undefined): Promise<{ directory: string }> {
    if (flagValue) {
        const { absolute } = resolveDirectoryFromFlag(flagValue);
        return {
            directory: absolute,
        };
    }

    try {
        const { config } = await loadInternalConfig();

        // Try cube directory first, fall back to cssRoot (which always has a default)
        const cubeDir = config.output.cube || config.output.cssRoot;
        const { absolute } = resolveDirectoryFromFlag(cubeDir);
        return {
            directory: absolute,
        };
    } catch (error) {
        if (isNoConfigError(error)) {
            const { absolute } = resolveDirectoryFromFlag("src/styles");
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
        return {
            directory: absolute,
        };
    }

    // Try to load config (auto-discovers resolver if no config file exists)
    try {
        const { config } = await loadInternalConfig();
        const componentsDir = config.output.components ?? "src/components/ui";
        const { absolute } = resolveDirectoryFromFlag(componentsDir);
        return {
            directory: absolute,
        };
    } catch (error) {
        if (isNoConfigError(error)) {
            const { absolute } = resolveDirectoryFromFlag("src/components/ui");
            return { directory: absolute };
        }
        throw error;
    }
}
