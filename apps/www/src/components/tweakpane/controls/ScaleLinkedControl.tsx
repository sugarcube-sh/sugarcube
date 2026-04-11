import type { PanelBinding } from "@sugarcube-sh/core/client";
import { labelForBinding } from "./resolver";
import { useScaleState } from "./scale-state";

type ScaleLinkedControlProps = {
    binding: PanelBinding;
};

/**
 * Toggle checkbox that links one token group to another's scale.
 *
 * For bindings like `{ token: "container.*", scalesWith: "size.step.*" }`,
 * renders a checkbox. When enabled, the linked group scales with the
 * source scale's base; when disabled, it stays at its original values.
 *
 * The linked group is pre-captured at module load (by walking the
 * panel config in `scale-state`), so this control is just a view over
 * its slot — no mount-time registration, no ordering concerns with the
 * source control.
 *
 * The "scale factor" is computed at apply time inside `scale-state`:
 * it's the source binding's current slider position divided by the
 * source's default. So moving the type base also rescales linked
 * containers in one atomic token-store update.
 */
export function ScaleLinkedControl({ binding }: ScaleLinkedControlProps) {
    const slot = useScaleState((state) => state.links[binding.token]);
    const setLinkEnabled = useScaleState((state) => state.setLinkEnabled);

    if (!slot) return null;

    const label = labelForBinding(binding);
    const inputId = `tweakpane-scale-linked-${binding.token.replace(/\./g, "-")}`;

    return (
        <div className="tweakpane-type-row">
            <label className="tweakpane-type-label" htmlFor={inputId} style={{ cursor: "pointer" }}>
                {label}
            </label>
            <input
                id={inputId}
                type="checkbox"
                checked={slot.enabled}
                onChange={(e) => setLinkEnabled(binding.token, e.target.checked)}
                aria-label={label}
            />
        </div>
    );
}
