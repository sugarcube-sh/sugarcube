import type { PanelBinding } from "@sugarcube-sh/core/client";
import { getScaleExtension } from "../store/TokenStore";
import { labelForBinding } from "./resolver";
import { useScaleState } from "./scale-state";

type ScaleControlProps = {
    binding: PanelBinding;
};

/**
 * Dispatcher for scale bindings.
 *
 * Checks whether the binding's target token group has a sugarcube scale
 * extension attached. If so, we dispatch to a Model B control that
 * edits the recipe parameters directly (exponential base/ratio/steps or
 * named multipliers). If not, we fall through to Model A — the cascade
 * approach that captures multipliers from the snapshot at module load
 * and transforms them via base + spread.
 *
 * MODEL B is not yet wired up — it waits on the scale extension landing
 * in core (see `notes/studio-panel-config-spec.md`). When it does, the
 * dispatcher will branch here into:
 *
 *   - `ExponentialScaleControl` for `scale.mode === "exponential"`
 *   - `MultipliersScaleControl` for `scale.mode === "multipliers"`
 *
 * Both will read the scale extension from `getScaleExtension(parent)`,
 * render recipe-parameter sliders, and write edits back via a shared
 * overlay + core's scale calculator. Model A will remain as the
 * fallback for users whose tokens are explicit (not scale-backed).
 */
export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const scaleExt = getScaleExtension(parent);

    if (scaleExt) {
        // MODEL B landing-zone — the scale extension exists on the
        // source tree but we don't have controls for it yet. Fall
        // through to cascade mode so the binding doesn't silently
        // disappear from the UI.
        // eslint-disable-next-line no-console
        console.warn(
            `[tweakpane] scale extension found at "${parent}" but Model B controls are not yet implemented; falling through to cascade`
        );
    }

    return <CascadeScaleControl binding={binding} />;
}

/**
 * Strip a trailing glob segment from a token path, e.g.
 * `"size.step.*"` → `"size.step"`. Used to find the parent group node
 * where a scale extension would live.
 */
function stripTrailingGlob(path: string): string {
    let result = path;
    while (result.endsWith(".*")) result = result.slice(0, -2);
    return result;
}

// ---------------------------------------------------------------------------
// Model A — cascade over captured multipliers
// ---------------------------------------------------------------------------

type CascadeScaleControlProps = {
    binding: PanelBinding;
};

/**
 * Model A scale control: renders `base` + `spread` sliders over a
 * captured group of dimension tokens.
 *
 * The captured scale is pre-populated in `scale-state` at module load
 * by walking the panel config — this control just reads its slot. If
 * the slot doesn't exist, the binding either has no `base` field or
 * its cascade couldn't be captured (warn already logged at module load).
 *
 * On slider change, the setter in `scale-state` triggers `applyAll`,
 * which re-runs every registered cascade + linked scale in a single
 * atomic token-store update.
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

    return (
        <>
            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">{baseLabel}</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={scale.baseMax * 0.75}
                    max={scale.baseMax * 1.5}
                    step={0.025}
                    value={base}
                    onChange={(e) => setBase(binding.token, Number(e.target.value))}
                    aria-label={baseLabel}
                    aria-valuetext={`${base}rem`}
                />
                <span className="tweakpane-slider-value">{base.toFixed(3)}</span>
            </div>
            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">{spreadLabel}</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={0.4}
                    max={1.6}
                    step={0.01}
                    value={spread}
                    onChange={(e) => setSpread(binding.token, Number(e.target.value))}
                    aria-label={spreadLabel}
                    aria-valuetext={`${spread.toFixed(2)}`}
                />
                <span className="tweakpane-slider-value">{spread.toFixed(2)}</span>
            </div>
        </>
    );
}
