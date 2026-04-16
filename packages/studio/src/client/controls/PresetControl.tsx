import type { PresetBinding } from "@sugarcube-sh/core/client";
import { useContext, useMemo, useState } from "react";
import type { PathIndex } from "../../store/path-index";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover/popover";
import type { TokenStoreAPI } from "../store/create-token-store";
import { StudioContext, usePathIndex, useToken } from "../store/hooks";
import { TokenRow } from "./TokenRow";
import { labelForBinding } from "./resolver";

type PresetControlProps = {
    binding: PresetBinding;
};

/**
 * Pick-from-options control. Renders a Framer-style trigger that shows the
 * current value, and opens a popover with a plain list of options. No search.
 */
export function PresetControl({ binding }: PresetControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const label = labelForBinding(binding);
    const pathIndex = usePathIndex();
    const store = useContext(StudioContext)?.store ?? null;
    const [open, setOpen] = useState(false);

    const options = useMemo(
        () => resolveOptions(binding.options, pathIndex, store),
        [binding.options, pathIndex, store]
    );

    const currentLabel = options.find((o) => o.reference === value)?.label ?? "—";

    return (
        <TokenRow path={binding.token} label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger className="preset-trigger">
                    <span className="preset-trigger-value">{capitalize(currentLabel)}</span>
                    <span className="preset-trigger-chevron" aria-hidden="true">
                        ▾
                    </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="preset-popover">
                    <div className="preset-list" role="listbox" tabIndex={0}>
                        {options.map(({ key, label: optLabel, reference }) => (
                            <div key={key} role="option" aria-selected={value === reference}>
                                <button
                                    type="button"
                                    className="preset-option"
                                    data-selected={value === reference || undefined}
                                    onClick={() => {
                                        setValue(reference);
                                        setOpen(false);
                                    }}
                                >
                                    <span>{capitalize(optLabel)}</span>
                                    {value === reference && (
                                        <span className="preset-check" aria-hidden="true">
                                            ✓
                                        </span>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </TokenRow>
    );
}

type ResolvedOption = {
    key: string;
    label: string;
    reference: string;
};

function resolveOptions(
    options: PresetBinding["options"],
    pathIndex: PathIndex,
    store: TokenStoreAPI | null
): ResolvedOption[] {
    if (typeof options === "string") {
        const getToken = store?.getState().getToken;
        const matches = pathIndex.matching(options);
        const matchSet = new Set(matches);
        return matches
            .filter((path) => {
                // Skip aliases whose TARGET is also in the matched set —
                // avoids showing both `font.body` and `font.sans` when both
                // match `font.*`. But keeps aliases to other namespaces
                // (e.g. `text.base → size.step.0` stays because `size.step.0`
                // is not in `text.*`).
                if (!getToken) return true;
                const val = getToken(path);
                if (typeof val !== "string" || !val.startsWith("{")) return true;
                const target = val.slice(1, -1);
                return !matchSet.has(target);
            })
            .map((path) => ({
                key: path,
                label: lastSegment(path),
                reference: `{${path}}`,
            }));
    }

    return Object.entries(options).map(([key, reference]) => ({
        key,
        label: key,
        reference,
    }));
}

function lastSegment(path: string): string {
    const lastDot = path.lastIndexOf(".");
    return lastDot === -1 ? path : path.substring(lastDot + 1);
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
