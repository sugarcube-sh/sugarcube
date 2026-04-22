import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { applyConverters } from "../src/shared/pipeline/apply-converters.js";
import { renderCSS } from "../src/shared/render-css.js";
import type { ConversionOptions, ConvertedToken } from "../src/types/convert.js";
import type { NormalizedTokens } from "../src/types/normalize.js";
import type { TokenType } from "../src/types/tokens.js";
import { configs } from "./__fixtures__/configs.js";
import { createResolvedToken } from "./__fixtures__/resolved-tokens.js";

/**
 * renderCSS is the Step-1 seam for PR 2. It must produce identical output
 * to the eager `$cssProperties` field populated by apply-converters —
 * otherwise Step 2's emitter switch would change behaviour.
 *
 * These tests lock in that contract across every token shape the pipeline
 * handles today.
 */
describe("renderCSS", () => {
    const config = fillDefaults(configs.basic);
    const options: ConversionOptions = {
        fluidConfig: config.variables.transforms.fluid,
        colorFallbackStrategy: config.variables.transforms.colorFallbackStrategy,
    };

    function runPipeline(tokens: NormalizedTokens) {
        return applyConverters(tokens, config);
    }

    it("matches $cssProperties for a simple color token", () => {
        const result = runPipeline({
            default: { "color.primary": createResolvedToken() },
        });
        const token = result.default?.["color.primary"] as ConvertedToken<TokenType>;
        expect(renderCSS(token, options)).toEqual(token.$cssProperties);
    });

    it("matches $cssProperties for a dimension token", () => {
        const result = runPipeline({
            default: {
                "spacing.small": createResolvedToken({
                    $type: "dimension",
                    $value: { value: 8, unit: "px" },
                    $path: "spacing.small",
                    $originalPath: "spacing.small",
                    $resolvedValue: { value: 8, unit: "px" },
                }),
            },
        });
        const token = result.default?.["spacing.small"] as ConvertedToken<TokenType>;
        expect(renderCSS(token, options)).toEqual(token.$cssProperties);
    });

    it("matches $cssProperties for a reference-bearing color token", () => {
        const result = runPipeline({
            default: {
                "color.primary": createResolvedToken(),
                "color.button": createResolvedToken({
                    $path: "color.button",
                    $originalPath: "color.button",
                    $value: "{color.primary}",
                    $resolvedValue: "#FF0000",
                }),
            },
        });
        const token = result.default?.["color.button"] as ConvertedToken<TokenType>;
        expect(renderCSS(token, options)).toEqual(token.$cssProperties);
    });
});
