import { generate } from "../pipeline/generate";
import type { InternalConfig } from "../types/config";
import type { NormalizedConvertedTokens } from "../types/convert";
import type { CSSFileOutput } from "../types/generate";
import type { ModifierMeta } from "../types/pipelines";

/**
 * Generate CSS variable files from converted tokens.
 *
 * @param convertedTokens - The normalized and converted tokens
 * @param config - The configuration object
 * @param modifiers - Optional modifier metadata for generating per-modifier attribute selectors
 * @returns Array of CSS file outputs
 */
export async function generateCSSVariables(
    convertedTokens: NormalizedConvertedTokens,
    config: InternalConfig,
    modifiers?: ModifierMeta[]
): Promise<CSSFileOutput> {
    const { output } = await generate(convertedTokens, config, modifiers);
    return output;
}
