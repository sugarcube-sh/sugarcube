import { generate } from "../pipeline/generate";
import type { InternalConfig } from "../types/config";
import type { NormalizedConvertedTokens } from "../types/convert";
import type { CSSFileOutput } from "../types/generate";

/**
 * Generate CSS variable files from converted tokens.
 *
 * @param convertedTokens - The normalized and converted tokens
 * @param config - The configuration object (must have permutations set)
 * @returns Array of CSS file outputs
 */
export async function generateCSSVariables(
    convertedTokens: NormalizedConvertedTokens,
    config: InternalConfig
): Promise<CSSFileOutput> {
    const { output } = await generate(convertedTokens, config);
    return output;
}
