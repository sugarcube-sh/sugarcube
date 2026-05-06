import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { useBaseline, useCurrentContext, usePathIndex, useScaleState } from "../store/hooks";
import { DEFAULT_SPREAD, selectCapture } from "../store/scale-selectors";
import { labelForBinding } from "./resolver";

type DirectScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Edits a hardcoded scale (concrete fluid tokens, no recipe) with two
 * sliders: a base value that anchors the scale, and a spread factor that
 * compresses or amplifies the gaps between steps.
 *
 * Capture (slider min/max) is derived from the live baseline per render —
 * an external file edit shifts the slider range to track the new disk values.
 */
export function DirectScaleControl({ binding }: DirectScaleControlProps) {
    const slot = useScaleState((state) => state.scales[binding.token]);
    const setBase = useScaleState((state) => state.setBase);
    const setSpread = useScaleState((state) => state.setSpread);
    const baseline = useBaseline();
    const pathIndex = usePathIndex();
    const context = useCurrentContext();

    if (!slot) return null;

    const captured = selectCapture(baseline, pathIndex, binding, context);
    if (!captured) return null;

    const base = slot.edits?.base ?? captured.baseMax;
    const spread = slot.edits?.spread ?? DEFAULT_SPREAD;

    const label = labelForBinding(binding);
    const baseLabel = `${label} base`;
    const spreadLabel = `${label} spread`;

    const baseMin = captured.baseMax * 0.75;
    const baseMax = captured.baseMax * 1.5;
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
