import type { FlattenedToken } from "../../src/types/flatten.js";
import type { TokenType } from "../../src/types/tokens.js";

export const createFlattenedToken = (
    overrides: Partial<FlattenedToken<TokenType>> = {}
): FlattenedToken<TokenType> => ({
    $type: "color" as const,
    $value: "#FF0000",
    $path: "color.primary",
    $source: { sourcePath: "test.json" },
    $originalPath: "color.primary",
    ...overrides,
});

export const flattenedTokens = {
    colorText: createFlattenedToken({
        $value: "{color.primary}",
        $path: "color.text",
        $originalPath: "color.text",
    }),
    shadowSmall: createFlattenedToken({
        $type: "shadow" as const,
        $value: {
            color: "{color.primary}",
            offsetX: "0px",
            offsetY: "1px",
            blur: "2px",
            spread: "0px",
        },
        $path: "shadow.small",
        $originalPath: "shadow.small",
    }),
    gradientPrimary: createFlattenedToken({
        $type: "gradient" as const,
        $value: [
            { color: "{color.primary}", position: "0%" },
            { color: "#000000", position: "100%" },
        ],
        $path: "gradient.primary",
        $originalPath: "gradient.primary",
    }),
};
