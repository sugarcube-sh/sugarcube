import type { PanelBinding } from "@sugarcube-sh/core/client";
import { useScaleState } from "../store/hooks";
import { labelForBinding } from "./resolver";

type ScaleLinkedControlProps = {
    binding: PanelBinding;
};

export function ScaleLinkedControl({ binding }: ScaleLinkedControlProps) {
    const slot = useScaleState((state) => state.links[binding.token]);
    const setLinkEnabled = useScaleState((state) => state.setLinkEnabled);

    if (!slot) return null;

    const label = labelForBinding(binding);
    const inputId = `studio-scale-linked-${binding.token.replace(/\./g, "-")}`;

    return (
        <div>
            <label htmlFor={inputId} style={{ cursor: "pointer" }}>
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
