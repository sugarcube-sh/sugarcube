import type { SugarcubeConfig } from "@sugarcube-sh/core";
import type { InitOptions } from "../types/index.js";

export async function buildSugarcubeConfig(options: InitOptions): Promise<SugarcubeConfig> {
    const config: SugarcubeConfig = {};

    if (
        options.stylesDir ||
        options.variablesDir ||
        options.variablesFilename ||
        options.utilitiesDir ||
        options.utilitiesFilename
    ) {
        config.output = {};

        if (options.stylesDir) {
            config.output.cssRoot = options.stylesDir;
        }

        if (options.variablesDir) {
            config.output.variables = options.variablesDir;
        }

        if (options.variablesFilename) {
            config.output.variablesFilename = options.variablesFilename;
        }

        if (options.utilitiesDir) {
            config.output.utilities = options.utilitiesDir;
        }

        if (options.utilitiesFilename) {
            config.output.utilitiesFilename = options.utilitiesFilename;
        }
    }

    if (options.fluidMin !== undefined || options.colorFallback) {
        config.transforms = {};

        if (options.fluidMin !== undefined && options.fluidMax !== undefined) {
            config.transforms.fluid = {
                min: Number(options.fluidMin),
                max: Number(options.fluidMax),
            };
        }

        if (options.colorFallback) {
            config.transforms.colorFallbackStrategy = options.colorFallback as
                | "native"
                | "polyfill";
        }
    }

    return config;
}
