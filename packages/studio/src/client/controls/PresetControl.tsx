import type { PresetBinding } from "@sugarcube-sh/core/client";
import { CheckIcon } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import type { PathIndex } from "../../store/path-index";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover/popover";
import type { TokenStoreAPI } from "../store/create-token-store";
import { StudioContext, usePathIndex, useToken } from "../store/hooks";
import { TokenRow } from "./TokenRow";
import { lastSegment, unwrapRef } from "./path-utils";
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
                                    {value === reference && <CheckIcon />}
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
                // Skip aliases whose terminal target is also in the matched
                // set. Walks the full ref chain so multi-hop aliases like
                // font.body → {font.serif} → {font.sans} are caught.
                // Keeps aliases to other namespaces (e.g. text.base →
                // size.step.0) since the target isn't in the matched set.
                if (!getToken) return true;
                const terminal = resolveTerminalPath(path, getToken);
                if (!terminal || terminal === path) return true;
                return !matchSet.has(terminal);
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

/** Walk a ref chain to its terminal path. Returns undefined if the value isn't a reference. */
function resolveTerminalPath(
    path: string,
    getToken: (path: string) => unknown
): string | undefined {
    const seen = new Set<string>();
    let current = path;

    while (true) {
        if (seen.has(current)) return current; // i.e. we've already seen this path, we're in a circle, so stop!
        seen.add(current);
        const val = getToken(current);
        const next = unwrapRef(val);
        if (!next) return current === path ? undefined : current;
        current = next;
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
