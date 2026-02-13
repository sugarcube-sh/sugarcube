import { convert } from "../pipeline/convert.js";
import { normalizeTokens } from "../pipeline/normalize.js";
import { processTrees } from "../pipeline/process-trees.js";
import type { NormalizedConvertedTokens } from "../types/convert.js";
import type { InternalConfig } from "../types/config.js";
import type { ResolvedTokens } from "../types/resolve.js";
import type { TokenTree } from "../types/tokens.js";
import type { ValidationError } from "../types/validate.js";

/**
 * Processes and converts token trees into CSS-ready format.
 * This pipeline:
 * 1. Processes trees with resolved tokens to create a unified structure
 * 2. Normalizes tokens into a context-based organization
 * 3. Converts tokens to their CSS representations with properties
 *
 *
 * @param trees - The token trees to process
 * @param resolved - The resolved tokens for processing
 * @param config - The sugarcube configuration
 * @param validationErrors - Optional array of validation errors. Tokens with validation errors will be filtered out before conversion.
 * @returns The processed and converted tokens ready for CSS generation
 *
 * @example
 * const convertedTokens = await processAndConvertTokens(trees, resolved, config);
 * // convertedTokens = { "default": { "token.path": { $cssProperties: {...} } }, "dark": {...} }
 */
export async function processAndConvertTokens(
    trees: TokenTree[],
    resolved: ResolvedTokens,
    config: InternalConfig,
    validationErrors?: ValidationError[]
): Promise<NormalizedConvertedTokens> {
    const processedTrees = processTrees(trees, resolved);
    const { tokens: normalizedTokens } = normalizeTokens(processedTrees);

    // Validation errors may have property-level paths (e.g., "token.path.unit"),
    // so we check if the token path is a prefix of any validation error path
    const isTokenInvalid = validationErrors
        ? (tokenPath: string): boolean => {
              return validationErrors.some(
                  (error) => error.path === tokenPath || error.path.startsWith(`${tokenPath}.`)
              );
          }
        : undefined;

    const convertedTokens = convert(normalizedTokens, config, isTokenInvalid);
    return convertedTokens;
}
