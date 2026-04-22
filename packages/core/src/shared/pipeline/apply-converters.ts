import type { InternalConfig } from "../../types/config.js";
import type {
    ConvertedToken,
    ConvertedTokens,
    NormalizedConvertedTokens,
} from "../../types/convert.js";
import type { NormalizedTokens } from "../../types/normalize.js";
import type { ResolvedToken, ResolvedTokens } from "../../types/resolve.js";
import type { TokenType } from "../../types/tokens.js";
// Used as a "which token types have a CSS renderer?" lookup — not for calling the
// renderers themselves. Apply-converters no longer renders; it populates metadata
// and filters unsupported types.
import { converters } from "../renderers/css/index.js";
import { createVariableNameResolver } from "../resolve-variable-name.js";

function convertSingleToken<T extends TokenType>(
    token: ResolvedToken<T>,
    varName: (path: string) => string
): ConvertedToken<T> {
    return {
        // Preserve all metadata properties
        ...(token.$description ? { $description: token.$description } : {}),
        ...(token.$extensions ? { $extensions: token.$extensions } : {}),

        // Core properties
        $type: token.$type,
        $value: token.$value,
        $path: token.$path,
        $source: token.$source,
        $originalPath: token.$originalPath,
        $names: { css: varName(token.$path) },
    };
}

function convertContext(
    tokens: ResolvedTokens,
    varName: (path: string) => string,
    isTokenInvalid?: (tokenPath: string) => boolean
): ConvertedTokens {
    const converted: ConvertedTokens = {};

    for (const [key, token] of Object.entries(tokens)) {
        if (!token || typeof token !== "object") continue;

        if (!("$type" in token)) {
            converted[key] = {
                ...(token.$description ? { $description: token.$description } : {}),
                ...(token.$extensions ? { $extensions: token.$extensions } : {}),
            };
            continue;
        }

        // Skip tokens with validation errors — prevents invalid CSS generation.
        // Validation errors are captured earlier in the pipeline (by resolveTokens).
        if (isTokenInvalid?.(token.$path)) {
            continue;
        }

        // Skip tokens whose type has no CSS renderer.
        if (!converters[token.$type as TokenType]) continue;

        converted[key] = convertSingleToken(token, varName);
    }

    return converted;
}

/**
 * Converts normalized tokens into their CSS representations.
 *
 * The function maintains the context structure while adding
 * CSS-specific properties to each token.
 *
 * @param tokens - The normalized tokens to convert
 * @param config - The sugarcube configuration containing conversion options
 * @returns The converted tokens with CSS properties, organized by context
 *
 * @example
 * // Input tokens
 * {
 *   default: {
 *     "color.primary": { $type: "color", $value: "#FF0000" }
 *   },
 *   dark: {
 *     "color.primary": { $type: "color", $value: "#000000" }
 *   }
 * }
 *
 * // Output after conversion
 * {
 *   default: {
 *     "color.primary": {
 *       $type: "color",
 *       $value: "#FF0000",
 *       $cssProperties: { value: "#FF0000" }
 *     }
 *   },
 *   dark: {
 *     "color.primary": {
 *       $type: "color",
 *       $value: "#000000",
 *       $cssProperties: { value: "#000000" }
 *     }
 *   }
 * }
 */
export function applyConverters(
    tokens: NormalizedTokens,
    config: InternalConfig,
    isTokenInvalid?: (tokenPath: string) => boolean
): NormalizedConvertedTokens {
    const converted: NormalizedConvertedTokens = {};
    // Bind once for perf! If you change this, you need to run a benchmark.
    const varName = createVariableNameResolver(config.variables);

    for (const [context, contextTokens] of Object.entries(tokens)) {
        converted[context] = convertContext(contextTokens, varName, isTokenInvalid);
    }

    return converted;
}
