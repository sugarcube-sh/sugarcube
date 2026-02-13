import { converters } from "../converters/index.js";
import type { InternalConfig } from "../types/config.js";
import type {
    ConversionOptions,
    ConvertedToken,
    ConvertedTokens,
    NormalizedConvertedTokens,
    TokenConverter,
} from "../types/convert.js";
import type { NormalizedTokens } from "../types/normalize.js";
import type { ResolvedToken, ResolvedTokens } from "../types/resolve.js";
import type { TokenType, TokenValue } from "../types/tokens.js";

function convertSingleToken<T extends TokenType>(
    token: ResolvedToken<T>,
    options: ConversionOptions
): ConvertedToken<T> {
    const converter = converters[token.$type] as TokenConverter<T>;

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
        $resolvedValue: token.$resolvedValue,
        $cssProperties: converter(token.$value as TokenValue<T>, options),
    };
}

function convertTokens(
    tokens: ResolvedTokens,
    config: InternalConfig,
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

        // Important: skip tokens with validation errors - prevents invalid CSS generation!
        // Errors are already tracked in validationErrors returned by loadAndResolveTokens
        if (isTokenInvalid?.(token.$path)) {
            continue;
        }

        // Skip tokens with unsupported types
        if (!converters[token.$type as TokenType]) continue;

        const options: ConversionOptions = {
            fluidConfig: config.transforms.fluid,
            colorFallbackStrategy: config.transforms.colorFallbackStrategy,
            path: token.$path,
            resolvedTokens: tokens,
        };

        converted[key] = convertSingleToken(token, options);
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
export function convert(
    tokens: NormalizedTokens,
    config: InternalConfig,
    isTokenInvalid?: (tokenPath: string) => boolean
): NormalizedConvertedTokens {
    const converted: NormalizedConvertedTokens = {};

    for (const [context, contextTokens] of Object.entries(tokens)) {
        converted[context] = convertTokens(contextTokens, config, isTokenInvalid);
    }

    return converted;
}
