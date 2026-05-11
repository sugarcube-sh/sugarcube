import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useBaseline } from "../store/hooks";
import { stripTrailingGlob } from "../tokens/paths";
import { getScaleExtension } from "../tokens/scale-extension";
import { DirectScaleControl } from "./DirectScaleControl";
import { ExponentialScaleControl } from "./ExponentialScaleControl";
import { MultipliersScaleControl } from "./MultipliersScaleControl";
import { PerStepScaleControl } from "./PerStepScaleControl";

type ScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Dispatches between editing models for a `type: "scale"` binding:
 *
 * - Scale extension at the bound path → extension controls (interactive).
 *   The extension's `mode` selects which control panel: exponential or
 *   multipliers.
 * - Otherwise → bulk sliders + per-step inputs stacked together, both
 *   editing the scale's concrete tokens.
 */
export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const baseline = useBaseline();
    const scale = getScaleExtension(baseline.trees, parent);

    if (scale?.mode === "exponential") {
        return <ExponentialScaleControl binding={binding} />;
    }
    if (scale?.mode === "multipliers") {
        return <MultipliersScaleControl binding={binding} />;
    }

    return (
        <>
            <DirectScaleControl binding={binding} />
            <PerStepScaleControl binding={binding} />
        </>
    );
}
