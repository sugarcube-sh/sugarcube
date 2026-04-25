import type { InternalConfig } from "../../types/config.js";
import type { NormalizedTokens } from "../../types/normalize.js";
import type {
    NormalizedRenderableTokens,
    RenderableToken,
    RenderableTokens,
} from "../../types/render.js";
import type { ResolvedToken, ResolvedTokens } from "../../types/resolve.js";
import type { TokenType } from "../../types/tokens.js";
import type { ValidationError } from "../../types/validate.js";
import { createVariableNameResolver } from "../resolve-variable-name.js";
import { toInvalidPredicate } from "../to-invalid-predicate.js";

function assignSingleTokenNames<T extends TokenType>(
    token: ResolvedToken<T>,
    varName: (path: string) => string
): RenderableToken<T> {
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

function assignContextNames(
    tokens: ResolvedTokens,
    varName: (path: string) => string,
    isTokenInvalid?: (tokenPath: string) => boolean
): RenderableTokens {
    const converted: RenderableTokens = {};

    for (const [key, token] of Object.entries(tokens)) {
        if (!token || typeof token !== "object") continue;

        if (!("$type" in token)) {
            converted[key] = {
                ...(token.$description ? { $description: token.$description } : {}),
                ...(token.$extensions ? { $extensions: token.$extensions } : {}),
            };
            continue;
        }

        // Skip tokens flagged as invalid by the validation step — prevents
        // invalid tokens (including unknown $type) from leaking into output.
        if (isTokenInvalid?.(token.$path)) continue;

        converted[key] = assignSingleTokenNames(token, varName);
    }

    return converted;
}

/**
 * Decide each token's CSS custom property name (e.g. `ds-color-primary`,
 * which the writer emits as `--ds-color-primary`) and store it on
 * `$names.css`.
 *
 * Runs once per pipeline and is the single source of truth for the name —
 * every downstream emitter (variable declarations, utility classes,
 * Studio) reads `$names.css` rather than deriving it from `$path` again.
 * Future formats will get their own sibling fields (`$names.js`,
 * `$names.scss`).
 *
 * Honours `variables.prefix` / `variables.variableName` config. Tokens
 * flagged invalid by the validation step are dropped.
 *
 * @example
 *   // With variables.prefix = "ds", a token at path "color.primary" gets:
 *   //   $names: { css: "ds-color-primary" }
 */
export function assignCSSNames(
    tokens: NormalizedTokens,
    config: InternalConfig,
    validationErrors?: ValidationError[]
): NormalizedRenderableTokens {
    const converted: NormalizedRenderableTokens = {};
    // Bind once for perf! If you change this, you need to run a benchmark.
    const varName = createVariableNameResolver(config.variables);
    const isTokenInvalid = toInvalidPredicate(validationErrors);

    for (const [context, contextTokens] of Object.entries(tokens)) {
        converted[context] = assignContextNames(contextTokens, varName, isTokenInvalid);
    }

    return converted;
}
