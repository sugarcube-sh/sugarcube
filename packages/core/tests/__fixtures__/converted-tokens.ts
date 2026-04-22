import { formatCSSVarName } from "../../src/shared/format-css-var-name.js";
import type { ConvertedToken } from "../../src/types/convert.js";
import type { TokenType } from "../../src/types/tokens.js";

/**
 * Build a ConvertedToken from an intent-shaped spec. `$names` derives from
 * `$path`; everything else is a direct override. Reference-bearing `$value`s
 * are fine here — the CSS emitter preserves them to `var(--…)` at emit time.
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

    return {
        $type,
        $value,
        $path,
        $source,
        $originalPath,
        ...($description !== undefined ? { $description } : {}),
        ...($extensions !== undefined ? { $extensions } : {}),
        $names: overrides.$names ?? { css: formatCSSVarName($path) },
    };
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
        $path: "shadow.primary",
    }),
};
