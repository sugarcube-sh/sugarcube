import type { PresetBinding } from "@sugarcube-sh/core/client";
import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover/popover";
import { Icon } from "../shell/Shell";
import { useBaseline, usePathIndex, useToken } from "../store/hooks";
import { TokenRow } from "./TokenRow";
import { labelForBinding } from "./path-utils";
import { resolveOptions } from "./preset-options";

type PresetControlProps = {
    binding: PresetBinding;
};

export function PresetControl({ binding }: PresetControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const label = labelForBinding(binding);
    const pathIndex = usePathIndex();
    const { resolved } = useBaseline();
    const [open, setOpen] = useState(false);

    const options = useMemo(
        () => resolveOptions(binding.options, pathIndex, resolved),
        [binding.options, pathIndex, resolved],
    );

    const currentLabel = options.find((o) => o.reference === value)?.label ?? "—";

    return (
        <TokenRow path={binding.token} label={label}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    className="select-trigger cluster w-full"
                    data-cluster-wrap="nowrap"
                >
                    <span className="flex-1 min-w-0 truncate">{currentLabel}</span>
                    <Icon name="caret" className="shrink-0 text-quiet" />
                </PopoverTrigger>
                <PopoverContent align="start" className="preset-popover">
                    <div
                        className="preset-list"
                        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom listbox: options contain buttons and icons, not plain text
                        role="listbox"
                        tabIndex={0}
                    >
                        {options.map(({ key, label: optLabel, reference }) => (
                            <div
                                key={key}
                                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom option with rich button content, not a native <option>
                                role="option"
                                aria-selected={value === reference}
                            >
                                <button
                                    type="button"
                                    className="preset-option cluster w-full"
                                    data-selected={value === reference || undefined}
                                    onClick={() => {
                                        setValue(reference);
                                        setOpen(false);
                                    }}
                                >
                                    <span>{optLabel}</span>
                                    {value === reference && <CheckIcon className="ms-auto" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </TokenRow>
    );
}
