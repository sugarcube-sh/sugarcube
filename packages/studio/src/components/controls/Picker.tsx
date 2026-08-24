"use client";

import { useState } from "react";
import { useFieldRow } from "../../shell/Field";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "../ui/command/command";
import { Icon } from "../ui/icon/Icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover/popover";
import { FieldTrigger, FieldTriggerContent, FieldTriggerPlaceholder } from "./FieldTrigger";

type PickerOption = {
    value: string;
    label?: string;
};

type PickerProps<Option extends PickerOption = PickerOption> = {
    "value": string | undefined;
    "onChange": (value: string) => void;
    "options": Option[];
    "searchable"?: boolean;
    "id"?: string;
    "disabled"?: boolean;
    "placeholder"?: string;
    "renderItem"?: (option: Option) => React.ReactNode;
    "renderValue"?: (option: Option) => React.ReactNode;
    "aria-label"?: string;
    "aria-labelledby"?: string;
};

function labelFor(option: PickerOption) {
    return option.label ?? option.value;
}

function Picker<Option extends PickerOption = PickerOption>({
    value,
    onChange,
    options,
    searchable = false,
    id,
    disabled,
    placeholder = "Select…",
    renderItem,
    renderValue,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
}: PickerProps<Option>) {
    const row = useFieldRow();
    const [open, setOpen] = useState(false);

    const selected = options.find((option) => option.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {/* Deliberately not taking the row's id: label[for] pointing at a button makes
                    the browser forward label clicks to it, which would open the popover. */}
                <FieldTrigger
                    id={id}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? row?.labelId)}
                >
                    <FieldTriggerContent>
                        {selected ? (
                            (renderValue?.(selected) ?? labelFor(selected))
                        ) : (
                            <FieldTriggerPlaceholder>{placeholder}</FieldTriggerPlaceholder>
                        )}
                    </FieldTriggerContent>
                </FieldTrigger>
            </PopoverTrigger>
            <PopoverContent align="start" className="picker-popover">
                <Command data-searchable={searchable || undefined} className="picker-command">
                    <CommandInput placeholder={searchable ? "Search…" : undefined} />
                    <CommandList>
                        <CommandEmpty>No matches</CommandEmpty>
                        {options.map((option) => (
                            <CommandItem
                                key={option.value}
                                value={labelFor(option)}
                                data-selected={option.value === value || undefined}
                                onSelect={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                            >
                                <span className="picker-item-check-slot" aria-hidden>
                                    {option.value === value ? <Icon name="check" /> : null}
                                </span>
                                {renderItem?.(option) ?? labelFor(option)}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export { Picker };
export type { PickerOption, PickerProps };
