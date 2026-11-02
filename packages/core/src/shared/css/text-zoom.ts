import type { ParseOptions, Permutation } from "@sugarcube-sh/dtcg";
import type { FluidConfig } from "../../types/config.js";
import { type AboutToken, aboutToken } from "../diagnostics.js";
import { fluidRangeOf, pixels } from "../fluid.js";
import { checkWCAG } from "./utopia.js";

export function textZoomWarnings(
    permutations: Permutation[],
    viewport: FluidConfig,
    options: ParseOptions,
): AboutToken[] {
    const found = new Map<string, AboutToken>();
    for (const permutation of permutations) {
        for (const each of permutation.tokens) {
            if (each.type !== "typography") continue;
            const target = each.getReferenceAt(["fontSize"])?.pointsToToken;
            const fluid = target && fluidRangeOf(target, options);
            if (!fluid) continue;
            const fails = checkWCAG({
                min: pixels(fluid.range.min),
                max: pixels(fluid.range.max),
                minWidth: viewport.min,
                maxWidth: viewport.max,
            });
            if (!fails) continue;
            const [from, to] = [Math.round(fails[0]), Math.round(fails[1])];
            const key = `${fluid.token.path}\u0000${from}\u0000${to}`;
            if (found.has(key)) continue;
            found.set(key, aboutToken(fluid.token, "fluid-text-zoom", { from, to }));
        }
    }
    return [...found.values()];
}
