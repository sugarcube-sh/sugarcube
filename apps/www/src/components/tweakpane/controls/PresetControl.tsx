import type { PanelBinding } from "@sugarcube-sh/core/client";
import { useMemo } from "react";
import { tokenPathsMatching, useToken } from "../store/TokenStore";
import { labelForBinding } from "./resolver";

type PresetControlProps = {
    binding: PanelBinding;
};

/**
 * Renders a row of preset buttons for bindings with `options`.
 *
 * Supports two `options` forms:
 *   - String glob pattern (e.g. `"radius.*"`): discovers each matching
 *     token path, builds a reference `{<path>}`, and labels the button
 *     with the last path segment.
 *   - Record mapping `{ label: reference }`: explicit label-to-value
 *     pairs for edge cases.
 */
export function PresetControl({ binding }: PresetControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const label = labelForBinding(binding);

    // Resolve options to a list of { label, reference } pairs.
    // Recomputed cheaply — both branches are O(n) over a small list.
    const options = useMemo(() => resolveOptions(binding.options), [binding.options]);

    return (
        <div className="tweakpane-preset-row">
            <span className="tweakpane-preset-label">{label}</span>
            <div className="tweakpane-preset-buttons">
                {options.map(({ key, label: optLabel, reference }) => (
                    <label
                        key={key}
                        data-selected={value === reference}
                        className="tweakpane-preset-button"
                    >
                        <input
                            type="radio"
                            name={label}
                            value={reference}
                            checked={value === reference}
                            onChange={() => setValue(reference)}
                            className="visually-hidden"
                        />
                        {optLabel}
                    </label>
                ))}
            </div>
        </div>
    );
}

type ResolvedOption = {
    key: string;
    label: string;
    reference: string;
};

function resolveOptions(options: PanelBinding["options"]): ResolvedOption[] {
    if (!options) return [];

    if (typeof options === "string") {
        // Glob pattern — each matching token becomes a preset.
        return tokenPathsMatching(options).map((path) => {
            const lastDot = path.lastIndexOf(".");
            const label = lastDot === -1 ? path : path.substring(lastDot + 1);
            return {
                key: path,
                label,
                reference: `{${path}}`,
            };
        });
    }

    // Record — explicit label-to-reference map.
    return Object.entries(options).map(([key, reference]) => ({
        key,
        label: key,
        reference,
    }));
}
