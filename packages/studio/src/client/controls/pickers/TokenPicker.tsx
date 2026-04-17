import { CheckIcon } from "lucide-react";
import { useState } from "react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "../../components/ui/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover/popover";

export type TokenOption = {
    /** Token path used as the binding target (e.g. "palette.base.500") */
    path: string;
    /** Resolved CSS color string for the swatch preview */
    color: string;
    /** Group heading this option falls under (e.g. "Base", "Accent") */
    group: string;
};

type Props = {
    /** Path of the currently bound token */
    currentPath: string;
    /** All options the user can pick from */
    options: TokenOption[];
    /** Fires with the newly picked path */
    onSelect: (path: string) => void;
    /** Optional label shown before the swatch+path in the trigger */
    label?: string;
};

/**
 * Searchable popover for picking a token to bind a value to.
 *
 * Trigger: row with optional label + current swatch + current path.
 * Content: cmdk-powered list grouped by family, typeahead filter.
 */
export function TokenPicker({ currentPath, options, onSelect, label }: Props) {
    const [open, setOpen] = useState(false);
    const current = options.find((o) => o.path === currentPath);

    const groups = options.reduce<Record<string, TokenOption[]>>((acc, opt) => {
        acc[opt.group] ??= [];
        acc[opt.group].push(opt);
        return acc;
    }, {});

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="token-picker-trigger">
                {label && <span className="token-picker-label">{label}</span>}
                <span
                    className="token-swatch"
                    style={{ backgroundColor: current?.color ?? "transparent" }}
                    aria-hidden="true"
                />
                <span className="token-picker-path">{currentPath}</span>
            </PopoverTrigger>
            <PopoverContent align="start">
                <Command>
                    <CommandInput placeholder="Search tokens…" />
                    <CommandList>
                        <CommandEmpty>No tokens found.</CommandEmpty>
                        {Object.entries(groups).map(([group, opts]) => (
                            <CommandGroup key={group} heading={group}>
                                {opts.map((opt) => (
                                    <CommandItem
                                        key={opt.path}
                                        value={opt.path}
                                        onSelect={() => {
                                            onSelect(opt.path);
                                            setOpen(false);
                                        }}
                                    >
                                        <span
                                            className="token-swatch"
                                            style={{ backgroundColor: opt.color }}
                                            aria-hidden="true"
                                        />
                                        <span>{opt.path}</span>
                                        {opt.path === currentPath && <CheckIcon />}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
