import { formatCSSVarName } from "../../src/shared/format-css-var-name.js";
import { isReference } from "../../src/shared/guards.js";
import type { ConvertedToken } from "../../src/types/convert.js";
import type { TokenType } from "../../src/types/tokens.js";

/**
 * Build a ConvertedToken from an intent-shaped spec. Dependent fields are
 * derived automatically so fixtures can't drift apart:
 *
 *  - `$resolvedValue` defaults to `$value` (valid for non-reference tokens;
 *     reference-bearing fixtures must opt in with an explicit override).
 *  - `$names` derives from `$path`.
 *
 * `$cssProperties` is no longer populated — the emitter renders from `$value`
 * at emit time via `renderCSS`.
 */
export const createConvertedToken = (
    overrides: Partial<ConvertedToken<TokenType>> = {}
): ConvertedToken<TokenType> => {
    const $type = overrides.$type ?? "color";
    const $value = overrides.$value ?? "#FF0000";
    const $path = overrides.$path ?? "color.primary";
    const $source = overrides.$source ?? { sourcePath: "test.json" };
    const $originalPath = overrides.$originalPath ?? $path;
    const $description = overrides.$description;
    const $extensions = overrides.$extensions;

    // Non-reference leaves resolve to themselves. Reference-bearing tokens
    // must specify what they resolve to — the factory can't know without
    // the other tokens.
    const $resolvedValue =
        overrides.$resolvedValue ??
        (typeof $value === "string" && isReference($value) ? undefined : $value);

    if ($resolvedValue === undefined) {
        throw new Error(
            `createConvertedToken: $value "${String($value)}" is a reference; pass an explicit $resolvedValue.`
        );
    }

    return {
        $type,
        $value,
        $path,
        $source,
        $originalPath,
        $resolvedValue,
        ...($description !== undefined ? { $description } : {}),
        ...($extensions !== undefined ? { $extensions } : {}),
        $names: overrides.$names ?? { css: formatCSSVarName($path) },
    } as ConvertedToken<TokenType>;
};

export const convertedTokens = {
    colorPrimary: createConvertedToken(),
    colorPrimaryDark: createConvertedToken({ $value: "#000000" }),
    typographyBody: createConvertedToken({
        $type: "typography",
        $value: {
            fontFamily: "Arial",
            fontSize: { value: 16, unit: "px" },
            lineHeight: 1.5,
            fontWeight: 400,
        },
        $path: "typography.body",
    }),
    spacingSmall: createConvertedToken({
        $type: "dimension",
        $value: { value: 8, unit: "px" },
        $path: "spacing.small",
    }),
    buttonPrimary: createConvertedToken({ $value: "#0000FF", $path: "button.primary" }),
    buttonSize: createConvertedToken({
        $type: "dimension",
        $value: { value: 40, unit: "px" },
        $path: "button.size",
    }),
    shadowPrimary: createConvertedToken({
        $type: "shadow",
        $value: {
            color: "{color.primary}",
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
        },
        // Reference-bearing: $resolvedValue must be explicit because the factory
        // can't walk references without the other tokens.
        $resolvedValue: {
            color: "#FF0000",
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
        },
        $path: "shadow.primary",
    }),
};
