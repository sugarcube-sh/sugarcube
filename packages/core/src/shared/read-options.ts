import type { ReadOptions } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../types/config.js";
import { fluidValidator } from "./fluid.js";
import { scaleGenerator } from "./scale/generator.js";

/**
 * Builds the options for reading design tokens from the config.
 *
 * @param config - The config with its defaults.
 *
 * @example
 * createReadOptions(config).inputs
 * // => [{ mode: "light" }, { mode: "dark" }]
 */
export function createReadOptions(config: InternalConfig): ReadOptions {
    const listed = config.variables.permutations ?? [];
    return {
        ...(listed.length > 0
            ? { inputs: listed.map(({ input }) => input) }
            : { inputs: "each-context" }),
        generators: [scaleGenerator],
        extensionValidators: [fluidValidator],
        hexStringColors: true,
        ignoreUnknownProperties: true,
    };
}
