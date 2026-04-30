import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useScaleState } from "../store/hooks";
import { labelForBinding } from "./resolver";

type DirectScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Edits a hardcoded scale (concrete fluid tokens, no recipe) with two
 * sliders: a base value that anchors the scale, and a spread factor that
 * compresses or amplifies the gaps between steps. Used for bindings that
 * point at scales authored as individual tokens rather than as recipes.
 */
export function DirectScaleControl({ binding }: DirectScaleControlProps) {
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
