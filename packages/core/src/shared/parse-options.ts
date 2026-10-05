import type { ParseOptions } from "@sugarcube-sh/dtcg";

/**
 * How sugarcube reads every value, in token files and in its own extensions alike: a hex-string
 * color as shorthand for sRGB, and a property a value's type does not define set aside with a
 * warning, so a design tool's `paragraphSpacing` does not lose its token.
 */
export const parseOptions = {
    hexStringColors: true,
    ignoreUnknownProperties: true,
} satisfies ParseOptions;
