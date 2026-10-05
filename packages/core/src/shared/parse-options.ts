import type { ParseOptions } from "@sugarcube-sh/dtcg";

/**
 * How sugarcube reads every value: a hex-string color as shorthand for sRGB, and a property a
 * value's type does not define set aside with a warning, so a design tool's `paragraphSpacing`
 * does not lose its token. Given to `read`, which hands it to the scale recipe and the fluid
 * check, and used again by the emitter, which reads each fluid range a second time.
 */
export const parseOptions = {
    hexStringColors: true,
    ignoreUnknownProperties: true,
} satisfies ParseOptions;
