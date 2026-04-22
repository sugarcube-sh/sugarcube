import type { InternalConfig } from "../types/config.js";
import type { NormalizedConvertedTokens } from "../types/convert.js";
import type { ResolvedTokens } from "../types/resolve.js";
import type { TokenTree } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";
import { assignCSSNames } from "./pipeline/assign-css-names.js";
import { groupByContext } from "./pipeline/group-by-context.js";

export type ConvertResult = {
    tokens: NormalizedConvertedTokens;
};

/**
 * Pure pipeline: resolved tokens + trees → tokens ready for CSS emission.
 *
 * Runs groupByContext → assignCSSNames.
 *
 * @param trees - The token trees (used to discover the set of contexts)
 * @param resolved - The resolved tokens
 * @param config - The sugarcube configuration
 * @param validationErrors - Optional array of validation errors. Tokens with
 *   validation errors are filtered out before conversion so invalid tokens
 *   never leak into generated CSS.
 */
export async function convertTokens(
    trees: TokenTree[],
    resolved: ResolvedTokens,
    config: InternalConfig,
    validationErrors?: ValidationError[]
): Promise<NormalizedConvertedTokens> {
    const grouped = groupByContext(trees, resolved);

    // Validation errors may have property-level paths (e.g., "token.path.unit"),
    // so we check if the token path is a prefix of any validation error path.
    const isTokenInvalid = validationErrors
        ? (tokenPath: string): boolean =>
              validationErrors.some(
                  (error) => error.path === tokenPath || error.path.startsWith(`${tokenPath}.`)
              )
        : undefined;

    return assignCSSNames(grouped, config, isTokenInvalid);
}
