/**
 * Expands a scale recipe into virtual DTCG dimension tokens.
 * Each step gets a `$type: "dimension"` token whose `$value` is the max
 * end of the fluid range, with the full fluid bounds carried on the
 * sh.sugarcube.fluid extension. The fluid renderer reads from there
 * to emit clamp() — so virtual scale tokens are indistinguishable from
 * manually-authored fluid tokens once they reach the renderer.
 */

import type { Token } from "../../types/dtcg.js";
import type { ScaleExtension } from "../../types/extensions.js";
import { calculateScale } from "./calculator.js";

export function resolveScaleExtension(scaleConfig: ScaleExtension): Record<string, Token> {
    const steps = calculateScale(scaleConfig);
    const tokens: Record<string, Token> = {};

    for (const step of steps) {
        tokens[step.name] = {
            $type: "dimension",
            $value: step.max,
            $extensions: {
                "sh.sugarcube": {
                    fluid: {
                        min: step.min,
                        max: step.max,
                        viewport: scaleConfig.viewport,
                    },
                },
            },
        };
    }

    return tokens;
}
