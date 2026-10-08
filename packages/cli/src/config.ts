import {
    type ColorFallbackStrategy,
    type ConfigOverrides,
    type LoadedConfig,
    loadInternalConfig,
} from "@sugarcube-sh/core";

export interface ConfigFlags {
    resolver?: string;
    variables?: string;
    utilities?: string;
    fluidMin?: number;
    fluidMax?: number;
    colorFallback?: ColorFallbackStrategy;
    prefix?: string;
    input?: string[];
    selector?: string;
}

export function loadConfig(flags: ConfigFlags = {}): Promise<LoadedConfig> {
    return loadInternalConfig(overridesFrom(flags));
}

function overridesFrom(flags: ConfigFlags): ConfigOverrides {
    const input = parseInputFlags(flags.input);
    return {
        resolver: flags.resolver,
        variables: {
            path: flags.variables,
            prefix: flags.prefix,
            transforms: {
                fluid: { min: flags.fluidMin, max: flags.fluidMax },
                colorFallbackStrategy: flags.colorFallback,
            },
            permutations: input && [{ input, selector: flags.selector ?? ":root" }],
        },
        utilities: { path: flags.utilities },
    };
}

/**
 * Parse --input flags into an input object.
 * Accepts formats like: --input theme=dark --input brand=ocean
 * Returns: { theme: "dark", brand: "ocean" }
 */
function parseInputFlags(inputFlags: string[] | undefined): Record<string, string> | undefined {
    const result: Record<string, string> = {};
    for (const flag of inputFlags ?? []) {
        const [modifier, contextValue] = flag.split("=");
        if (modifier && contextValue) {
            result[modifier] = contextValue;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
