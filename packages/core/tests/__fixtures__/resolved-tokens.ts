import type { ResolvedToken } from "../../src/types/resolve.js";
import type { TokenType } from "../../src/types/tokens.js";

export const createResolvedToken = (
    overrides: Partial<ResolvedToken<TokenType>> = {}
): ResolvedToken<TokenType> => ({
    $type: "color" as const,
    $value: "#FF0000",
    $path: "color.primary",
    $source: { sourcePath: "test.json" },
    $originalPath: "color.primary",
    $resolvedValue: "#FF0000",
    ...overrides,
});
