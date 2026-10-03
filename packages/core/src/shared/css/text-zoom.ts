import { type Permutation, isAlias, referenceAt, token } from "@sugarcube-sh/dtcg";
import type { FluidConfig } from "../../types/config.js";
import type { SugarcubeDiagnostic } from "../../types/diagnostics.js";
import { ErrorMessages, diagnosticDocs } from "../constants/error-messages.js";
import { fluidRangeOf, pixels } from "../fluid.js";
import { checkWCAG } from "./utopia.js";

export function textZoomWarnings(
    permutations: Permutation[],
    viewport: FluidConfig,
): SugarcubeDiagnostic[] {
    const found = new Map<string, SugarcubeDiagnostic>();
    for (const permutation of permutations) {
        for (const each of permutation.tokens) {
            if (each.type !== "typography") continue;
            const ref = referenceAt(each, ["fontSize"]);
            const target = ref && isAlias(ref) ? token(permutation, ref.alias) : undefined;
            const fluid = target && fluidRangeOf(permutation, target);
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
            found.set(key, {
                kind: "fluid-text-zoom",
                severity: "warning",
                message: ErrorMessages.DIAGNOSTICS["fluid-text-zoom"]({ from, to }),
                path: fluid.token.path,
                at: fluid.token.source.at,
                docs: diagnosticDocs("fluid-text-zoom"),
                detail: { from, to },
            });
        }
    }
    return [...found.values()];
}
