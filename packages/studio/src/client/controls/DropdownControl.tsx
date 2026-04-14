import type { PanelBinding } from "@sugarcube-sh/core/client";
import { useContext, useMemo } from "react";
import type { PathIndex } from "../../store/path-index";
import type { TokenStoreAPI } from "../store/create-token-store";
import { StudioContext, usePathIndex, useToken } from "../store/hooks";
import { labelForBinding } from "./resolver";

type DropdownControlProps = {
    binding: PanelBinding;
};

export function DropdownControl({ binding }: DropdownControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const label = labelForBinding(binding);
    const inputId = `studio-dropdown-${binding.token.replace(/\./g, "-")}`;
    const pathIndex = usePathIndex();
    const store = useContext(StudioContext)?.store ?? null;

    const options = useMemo(
        () => resolveOptions(binding.options, pathIndex, store),
        [binding.options, pathIndex, store]
    );

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

function resolveOptions(
    options: PanelBinding["options"],
    pathIndex: PathIndex,
    store: TokenStoreAPI | null
): ResolvedOption[] {
    if (!options) return [];

    if (typeof options === "string") {
        const getToken = store?.getState().getToken;
        return pathIndex
            .matching(options)
            .filter((path) => {
                if (!getToken) return true;
                const value = getToken(path);
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
