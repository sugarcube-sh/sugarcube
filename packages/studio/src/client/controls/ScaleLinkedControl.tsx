import type { ScaleLinkedBinding } from "@sugarcube-sh/core/client";
import { useScaleState } from "../store/hooks";
import { labelForBinding } from "./resolver";

type ScaleLinkedControlProps = {
    binding: ScaleLinkedBinding;
};

export function ScaleLinkedControl({ binding }: ScaleLinkedControlProps) {
    const slot = useScaleState((state) => state.links[binding.token]);
    const setLinkEnabled = useScaleState((state) => state.setLinkEnabled);

    if (!slot) return null;

    const label = labelForBinding(binding);
    const inputId = `studio-scale-linked-${binding.token.replace(/\./g, "-")}`;

    return (
        <div className="scale-linked-row">
            <label className="scale-linked-label" htmlFor={inputId}>
                {label}
            </label>
            <input
                className="scale-linked-toggle"
                id={inputId}
                type="checkbox"
                checked={slot.enabled}
                onChange={(e) => setLinkEnabled(binding.token, e.target.checked)}
                aria-label={label}
            />
        </div>
    );
}
