import type { ScaleLinkedBinding } from "@sugarcube-sh/core/client";
import { useScaleState } from "../store/hooks";
import { labelForBinding } from "./path-utils";

type ScaleLinkedControlProps = {
    binding: ScaleLinkedBinding;
};

// TODO: linked/follower scales aren't covered by the scale extension spec yet.
export function ScaleLinkedControl({ binding }: ScaleLinkedControlProps) {
    const linkMeta = useScaleState((state) => state.linkBindings[binding.token]);
    const linkEdit = useScaleState((state) => state.links[binding.token]);
    const setLinkEnabled = useScaleState((state) => state.setLinkEnabled);

    if (!linkMeta) return null;

    const enabled = linkEdit?.enabled ?? true;
    const label = labelForBinding(binding);
    const inputId = `studio-scale-linked-${binding.token.replace(/\./g, "-")}`;

    return (
        <div className="scale-linked-row">
            <label className="scale-linked-label" htmlFor={inputId}>
                {label}
            </label>
            <input
                className="switch"
                id={inputId}
                type="checkbox"
                role="switch"
                checked={enabled}
                aria-checked={enabled}
                onChange={(e) => setLinkEnabled(binding.token, e.target.checked)}
                aria-label={label}
            />
            <span className="switch-state" aria-hidden="true" />
        </div>
    );
}
