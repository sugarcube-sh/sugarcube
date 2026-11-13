import type { ParseOptions, Permutation } from "@sugarcube-sh/dtcg";
import type { FluidViewport } from "../../types/config.js";
import { type TokenProblem, createTokenProblem } from "../diagnostics.js";
import { findFluidRange, toPixels } from "../fluid.js";
import { checkWCAG } from "./utopia.js";

export function findTextZoomProblems(
    permutations: Permutation[],
    viewport: FluidViewport,
    options: ParseOptions,
): TokenProblem[] {
    const found = new Map<string, TokenProblem>();
    for (const permutation of permutations) {
        for (const each of permutation.tokens) {
            if (each.type !== "typography") continue;
            const target = each.getReferenceAt(["fontSize"])?.pointsToWholeToken;
            const fluid = target && findFluidRange(target, options);
            if (!fluid) continue;
            const failingRange = checkWCAG({
                min: toPixels(fluid.range.min),
                max: toPixels(fluid.range.max),
                minWidth: viewport.min,
                maxWidth: viewport.max,
            });
            if (!failingRange) continue;
            const [from, to] = [Math.round(failingRange[0]), Math.round(failingRange[1])];
            const key = `${fluid.token.path}\u0000${from}\u0000${to}`;
            if (found.has(key)) continue;
            found.set(key, createTokenProblem(fluid.token, "fluid-text-zoom", { from, to }));
        }
    }
    return [...found.values()];
}
