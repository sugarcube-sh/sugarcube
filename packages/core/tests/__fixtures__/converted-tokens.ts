import type { ConvertedToken } from "../../src/types/convert.js";
import type { TokenType } from "../../src/types/tokens.js";

export const createConvertedToken = (
    overrides: Partial<ConvertedToken<TokenType>> = {}
): ConvertedToken<TokenType> => ({
    $type: "color" as const,
    $value: "#FF0000",
    $path: "color.primary",
    $source: { sourcePath: "test.json" },
    $originalPath: "color.primary",
    $resolvedValue: "#FF0000",
    $cssProperties: { value: "#FF0000" },
    ...overrides,
});

export const convertedTokens = {
    colorPrimary: createConvertedToken(),
    colorPrimaryDark: createConvertedToken({
        $value: "#000000",
        $resolvedValue: "#000000",
        $cssProperties: { value: "#000000" },
    }),
    typographyBody: createConvertedToken({
        $type: "typography" as const,
        $value: {
            fontFamily: "Arial",
            fontSize: "16px",
            lineHeight: 1.5,
            fontWeight: 400,
        },
        $path: "typography.body",
        $originalPath: "typography.body",
        $resolvedValue: {
            fontFamily: "Arial",
            fontSize: "16px",
            lineHeight: 1.5,
            fontWeight: 400,
        },
        $cssProperties: {
            "font-family": "Arial",
            "font-size": "16px",
            "line-height": 1.5,
            "font-weight": 400,
        },
    }),
    spacingSmall: createConvertedToken({
        $type: "dimension" as const,
        $value: "8px",
        $path: "spacing.small",
        $originalPath: "spacing.small",
        $resolvedValue: "8px",
        $cssProperties: { value: "8px" },
    }),
    buttonPrimary: createConvertedToken({
        $value: "#0000FF",
        $path: "button.primary",
        $originalPath: "button.primary",
        $resolvedValue: "#0000FF",
        $cssProperties: { value: "#0000FF" },
    }),
    buttonSize: createConvertedToken({
        $type: "dimension" as const,
        $value: "40px",
        $path: "button.size",
        $originalPath: "button.size",
        $resolvedValue: "40px",
        $cssProperties: { value: "40px" },
    }),
    shadowPrimary: createConvertedToken({
        $type: "shadow" as const,
        $value: {
            color: "{color.primary}",
            offsetX: "0px",
            offsetY: "2px",
            blur: "4px",
            spread: "0px",
        },
        $path: "shadow.primary",
        $originalPath: "shadow.primary",
        $resolvedValue: {
            color: "#FF0000",
            offsetX: "0px",
            offsetY: "2px",
            blur: "4px",
            spread: "0px",
        },
        $cssProperties: {
            value: "0px 2px 4px 0px var(--color-primary)",
        },
    }),
};
