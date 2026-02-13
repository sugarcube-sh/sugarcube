import { CLIError } from "../types/index.js";
import type { InitOptions } from "../types/index.js";
import { validateDirectoryPath } from "./paths";

export function validateOptions(options: InitOptions): void {
    if (options.tokensDir) {
        validateDirectoryPath(options.tokensDir, "tokens-dir");
    }

    if (options.stylesDir) {
        validateDirectoryPath(options.stylesDir, "styles-dir");
    }

    // Validate fluid flags are provided together
    const hasFluidMin = options.fluidMin !== undefined;
    const hasFluidMax = options.fluidMax !== undefined;

    if (hasFluidMin !== hasFluidMax) {
        throw new CLIError(
            "Both --fluid-min and --fluid-max must be provided together.\n\n" +
                "Either specify both flags or omit both to use defaults (320px - 1200px)."
        );
    }
}
