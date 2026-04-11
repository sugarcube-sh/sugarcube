import type { PanelBinding } from "@sugarcube-sh/core/client";
import { useMemo } from "react";
import { tokenPathsMatching, useToken, useTokenStore } from "../store/TokenStore";
import { labelForBinding } from "./resolver";

type DropdownControlProps = {
    binding: PanelBinding;
};

/**
 * Select dropdown for bindings with `options` on font/text tokens.
 *
 * Same options format as `PresetControl` (glob string or explicit
 * record), but rendered as a `<select>` rather than buttons. Use for
 * long option lists where buttons would wrap awkwardly, or for font
 * family pickers where the dropdown convention is familiar.
 */
export function DropdownControl({ binding }: DropdownControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const label = labelForBinding(binding);
    const inputId = `tweakpane-dropdown-${binding.token.replace(/\./g, "-")}`;

    const options = useMemo(() => resolveOptions(binding.options), [binding.options]);

    return (
        <div className="tweakpane-type-row">
            <label className="tweakpane-type-label" htmlFor={inputId}>
                {label}
            </label>
            <select
                id={inputId}
                className="tweakpane-type-select"
                value={value ?? ""}
                onChange={(e) => setValue(e.target.value)}
            >
                {options.map(({ key, label: optLabel, reference }) => (
                    <option key={key} value={reference}>
                        {capitalize(optLabel)}
                    </option>
                ))}
            </select>
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
        // Glob pattern — each matching token becomes an option, but
        // only those that are themselves value tokens (not references
        // to other tokens). For font families, this filters out
        // reference tokens like `font.body` → `{font.sans}`.
        const { getToken } = useTokenStore.getState();
        return tokenPathsMatching(options)
            .filter((path) => {
                const value = getToken(path);
                // A value token has a concrete value, not a `{...}` ref.
                return typeof value !== "string" || !value.startsWith("{");
            })
            .map((path) => {
                const lastDot = path.lastIndexOf(".");
                const label = lastDot === -1 ? path : path.substring(lastDot + 1);
                return {
                    key: path,
                    label,
                    reference: `{${path}}`,
                };
            });
    }

    return Object.entries(options).map(([key, reference]) => ({
        key,
        label: key,
        reference,
    }));
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
