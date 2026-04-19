import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useScaleState, useSnapshot } from "../store/hooks";
import { getScaleExtension } from "../tokens/scale-extension";
import { stripTrailingGlob } from "./path-utils";
import { labelForBinding } from "./resolver";

type ScaleControlProps = {
    binding: ScaleBinding;
};

export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const snapshot = useSnapshot();
    const scaleExt = getScaleExtension(snapshot.trees, parent);

    if (scaleExt) {
        console.warn(
            `[studio] scale extension found at "${parent}" but Model B controls are not yet implemented; falling through to cascade`
        );
    }

    return <CascadeScaleControl binding={binding} />;
}

type CascadeScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Temporary scale control using abstract base/spread sliders.
 *
 * Will be replaced when the scale extension lands — the real controls
 * will map directly to the scale config fields (base.min, base.max,
 * ratio.min, ratio.max, viewport, step count, etc.).
 */
function CascadeScaleControl({ binding }: CascadeScaleControlProps) {
    const slot = useScaleState((state) => state.scales[binding.token]);
    const setBase = useScaleState((state) => state.setBase);
    const setSpread = useScaleState((state) => state.setSpread);

    if (!slot) return null;

    const { scale, base, spread } = slot;
    const label = labelForBinding(binding);
    const baseLabel = `${label} base`;
    const spreadLabel = `${label} spread`;

    const baseMin = scale.baseMax * 0.75;
    const baseMax = scale.baseMax * 1.5;
    const basePct = ((base - baseMin) / (baseMax - baseMin)) * 100;
    const spreadPct = ((spread - 0.4) / (1.6 - 0.4)) * 100;

    return (
        <>
            <div className="scale-row">
                <span className="scale-label">{baseLabel}</span>
                <input
                    className="scale-slider"
                    type="range"
                    min={baseMin}
                    max={baseMax}
                    step={0.025}
                    value={base}
                    onChange={(e) => setBase(binding.token, Number(e.target.value))}
                    aria-label={baseLabel}
                    aria-valuetext={`${base}rem`}
                    style={{ "--fill": `${basePct}%` } as React.CSSProperties}
                />
                <span className="scale-value">{base.toFixed(3)}</span>
            </div>
            <div className="scale-row">
                <span className="scale-label">{spreadLabel}</span>
                <input
                    className="scale-slider"
                    type="range"
                    min={0.4}
                    max={1.6}
                    step={0.01}
                    value={spread}
                    onChange={(e) => setSpread(binding.token, Number(e.target.value))}
                    aria-label={spreadLabel}
                    aria-valuetext={spread.toFixed(2)}
                    style={{ "--fill": `${spreadPct}%` } as React.CSSProperties}
                />
                <span className="scale-value">{spread.toFixed(2)}</span>
            </div>
        </>
    );
}
