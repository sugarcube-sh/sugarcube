import type {
    ColorFallbackStrategy,
    FluidConfig,
    InternalConfig,
    SugarcubeConfig,
} from "@sugarcube-sh/core";
import {
    configFileExists,
    fillDefaults,
    findResolverDocument,
    loadInternalConfig,
} from "@sugarcube-sh/core";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { CLIError } from "../types/index.js";

export interface GenerateFlags {
    force?: boolean;
    silent?: boolean;
    watch?: boolean;
    resolver?: string;
    stylesDir?: string;
    variablesDir?: string;
    variablesFilename?: string;
    utilitiesDir?: string;
    utilitiesFilename?: string;
    fluidMin?: string;
    fluidMax?: string;
    colorFallback?: ColorFallbackStrategy;
}

export function validateFlags(flags: GenerateFlags): void {
    if (flags.colorFallback && !["native", "polyfill"].includes(flags.colorFallback)) {
        throw new CLIError(
            `Invalid --color-fallback value: "${flags.colorFallback}". Must be "native" or "polyfill".`
        );
    }

    if (flags.fluidMin) {
        const min = Number.parseInt(flags.fluidMin, 10);
        if (Number.isNaN(min) || min <= 0) {
            throw new CLIError(
                `Invalid --fluid-min value: "${flags.fluidMin}". Must be a positive number.`
            );
        }
    }

    if (flags.fluidMax) {
        const max = Number.parseInt(flags.fluidMax, 10);
        if (Number.isNaN(max) || max <= 0) {
            throw new CLIError(
                `Invalid --fluid-max value: "${flags.fluidMax}". Must be a positive number.`
            );
        }
    }
}

function parseFluidValue(value: string | undefined, fallback: number): number {
    return value ? Number.parseInt(value, 10) : fallback;
}

function buildFluidConfig(flags: GenerateFlags): FluidConfig | undefined {
    if (!flags.fluidMin && !flags.fluidMax) return undefined;
    return {
        min: parseFluidValue(flags.fluidMin, 320),
        max: parseFluidValue(flags.fluidMax, 1200),
    };
}

function buildConfigFromFlags(flags: GenerateFlags): InternalConfig {
    const userConfig: SugarcubeConfig = {
        resolver: flags.resolver,
        output: {
            cssRoot: flags.stylesDir,
            variables: flags.variablesDir,
            variablesFilename: flags.variablesFilename,
            utilities: flags.utilitiesDir,
            utilitiesFilename: flags.utilitiesFilename,
        },
        transforms: {
            fluid: buildFluidConfig(flags),
            colorFallbackStrategy: flags.colorFallback,
        },
    };

    return fillDefaults(userConfig);
}

function mergeConfigWithFlags(config: InternalConfig, flags: GenerateFlags): InternalConfig {
    return {
        ...config,
        resolver: flags.resolver ?? config.resolver,
        transforms: {
            fluid: {
                min: parseFluidValue(flags.fluidMin, config.transforms.fluid.min),
                max: parseFluidValue(flags.fluidMax, config.transforms.fluid.max),
            },
            colorFallbackStrategy: flags.colorFallback ?? config.transforms.colorFallbackStrategy,
        },
        output: {
            ...config.output,
            cssRoot: flags.stylesDir ?? config.output.cssRoot,
            variables: flags.variablesDir ?? config.output.variables,
            variablesFilename: flags.variablesFilename ?? config.output.variablesFilename,
            utilities: flags.utilitiesDir ?? config.output.utilities,
            utilitiesFilename: flags.utilitiesFilename ?? config.output.utilitiesFilename,
        },
    };
}

function hasConfigFlags(flags: GenerateFlags): boolean {
    return !!(
        flags.resolver ||
        flags.stylesDir ||
        flags.variablesDir ||
        flags.variablesFilename ||
        flags.utilitiesDir ||
        flags.utilitiesFilename ||
        flags.fluidMin ||
        flags.fluidMax ||
        flags.colorFallback
    );
}

export async function resolveConfig(options: GenerateFlags): Promise<InternalConfig> {
    if (configFileExists()) {
        const { config: loadedConfig } = await loadInternalConfig();
        return mergeConfigWithFlags(loadedConfig, options);
    }

    // Note: We do our own discovery here instead of using loadInternalConfig's fallback
    // because generate needs special flag-merging logic that loadInternalConfig doesn't handle.
    const discovery = await findResolverDocument(process.cwd());

    if (discovery.found === "multiple") {
        throw new CLIError(ERROR_MESSAGES.GENERATE_MULTIPLE_RESOLVERS_NO_CONFIG(discovery.paths));
    }

    const resolverPath =
        options.resolver ?? (discovery.found === "one" ? discovery.path : undefined);

    if (resolverPath || hasConfigFlags(options)) {
        return buildConfigFromFlags({ ...options, resolver: resolverPath });
    }

    throw new CLIError(ERROR_MESSAGES.GENERATE_NO_CONFIG_OR_RESOLVER());
}
