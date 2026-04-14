import type { PanelBinding } from "@sugarcube-sh/core/client";
import { useMemo } from "react";
import type { PathIndex } from "../../store/path-index";
import { usePathIndex, useToken } from "../store/hooks";
import { labelForBinding } from "./resolver";

type PresetControlProps = {
    binding: PanelBinding;
};

export function PresetControl({ binding }: PresetControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const label = labelForBinding(binding);
    const pathIndex = usePathIndex();

    const options = useMemo(
        () => resolveOptions(binding.options, pathIndex),
        [binding.options, pathIndex]
    );

    return (
        <div>
            <span>{label}</span>
            <div>
                {options.map(({ key, label: optLabel, reference }) => (
                    <label key={key} data-selected={value === reference}>
                        <input
                            type="radio"
                            name={label}
                            value={reference}
                            checked={value === reference}
                            onChange={() => setValue(reference)}
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

function resolveOptions(options: PanelBinding["options"], pathIndex: PathIndex): ResolvedOption[] {
    if (!options) return [];

    if (typeof options === "string") {
        return pathIndex.matching(options).map((path) => {
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
