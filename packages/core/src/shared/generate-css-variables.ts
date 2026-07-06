import type { InternalConfig, Permutation } from "../types/config.js";
import type { CSSFileOutput } from "../types/generate.js";
import type { NormalizedRenderableTokens } from "../types/render.js";
import { formatCSSVariables } from "./pipeline/format-css-variables.js";

/**
 * Generate CSS variable files from converted tokens.
 *
 * @param convertedTokens - The normalized and converted tokens
 * @param config - The configuration object
 * @param permutations - The effective permutations from the loading pipeline
 * @returns Array of CSS file outputs
 */
export async function generateCSSVariables(
    convertedTokens: NormalizedRenderableTokens,
    config: InternalConfig,
    permutations: Permutation[],
): Promise<CSSFileOutput> {
    const { output } = await formatCSSVariables(convertedTokens, config, permutations);
    return output;
}
