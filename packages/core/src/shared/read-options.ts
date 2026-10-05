import type { ReadOptions } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../types/config.js";
import { fluidValidator } from "./fluid.js";
import { scaleGenerator } from "./scale/generator.js";

/**
 * How sugarcube reads a design system with `dtcg`: the permutations the config lists, or the
 * default and each context on its own when it lists none; the scale recipes; the fluid range's
 * check; a hex-string color as shorthand for sRGB; and a property a value's type does not define
 * set aside with a warning, so a design tool's `paragraphSpacing` does not lose its token.
 *
 * @example
 * const doc = await read(config.resolver, readOptions(config));
 */
export function readOptions(config: InternalConfig): ReadOptions {
    const listed = config.variables.permutations ?? [];
    return {
        ...(listed.length > 0
            ? { inputs: listed.map(({ input }) => input) }
            : { permutations: "each-context" }),
        generators: [scaleGenerator],
        extensionValidators: [fluidValidator],
        hexStringColors: true,
        ignoreUnknownProperties: true,
    };
}
