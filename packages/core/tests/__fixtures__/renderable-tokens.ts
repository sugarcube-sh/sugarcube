import { formatCSSVarName } from "../../src/shared/format-css-var-name.js";
import type { RenderableToken } from "../../src/types/render.js";
import type { TokenType } from "../../src/types/tokens.js";

/**
 * Test helper: builds a RenderableToken with sensible defaults so each test
 * only spells out the fields it actually cares about.
 *
 * `$names.css` is auto-derived from `$path`, the same way the real pipeline
 * does it. Everything else comes straight from `overrides`.
 *
 * DTCG references like `"{color.primary}"` are fine to use in `$value` —
 * the CSS emitter turns them into `var(--…)` later, so tests don't need
 * to pre-resolve them.
 */
export const createRenderableToken = (
    overrides: Partial<RenderableToken<TokenType>> = {}
): RenderableToken<TokenType> => {
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
    colorPrimary: createRenderableToken(),
    colorPrimaryDark: createRenderableToken({ $value: "#000000" }),
    typographyBody: createRenderableToken({
        $type: "typography",
        $value: {
            fontFamily: "Arial",
            fontSize: { value: 16, unit: "px" },
            lineHeight: 1.5,
            fontWeight: 400,
        },
        $path: "typography.body",
    }),
    spacingSmall: createRenderableToken({
        $type: "dimension",
        $value: { value: 8, unit: "px" },
        $path: "spacing.small",
    }),
    buttonPrimary: createRenderableToken({ $value: "#0000FF", $path: "button.primary" }),
    buttonSize: createRenderableToken({
        $type: "dimension",
        $value: { value: 40, unit: "px" },
        $path: "button.size",
    }),
    shadowPrimary: createRenderableToken({
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
