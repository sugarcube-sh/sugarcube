import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "../../components/ui/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover/popover";

export type PaletteOption = {
    /** Palette identifier (e.g. "slate", "blue") */
    name: string;
    /** Resolved CSS colors for the strip preview, ordered light → dark */
    shades: string[];
};

type Props = {
    currentName: string;
    options: PaletteOption[];
    onSelect: (name: string) => void;
};

/**
 * Searchable popover for picking a full palette (ramp) to assign
 * to a role like "Base" or "Accent". Selecting a palette rebinds
 * the whole ramp's tokens in one logical change.
 */
export function PalettePicker({ currentName, options, onSelect }: Props) {
    const [open, setOpen] = useState(false);
    const current = options.find((o) => o.name === currentName);

    // cmdk lowercases values internally — map back to the real name.
    const nameByLower = useMemo(
        () => new Map(options.map((o) => [o.name.toLowerCase(), o.name])),
        [options]
    );

    const resolve = (lowered: string) => nameByLower.get(lowered) ?? lowered;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="palette-picker-trigger">
                <PaletteStrip shades={current?.shades ?? []} />
                <span className="palette-picker-name">{currentName}</span>
            </PopoverTrigger>
            <PopoverContent align="start">
                <Command onValueChange={(v) => onSelect(resolve(v))}>
                    <CommandInput placeholder="Filter palettes…" />
                    <CommandList>
                        <CommandEmpty>No palettes found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.name}
                                    value={opt.name}
                                    onSelect={() => {
                                        onSelect(opt.name);
                                        setOpen(false);
                                    }}
                                >
                                    <PaletteStrip shades={opt.shades} />
                                    <span>{opt.name}</span>
                                    {opt.name === currentName && <CheckIcon />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function PaletteStrip({ shades }: { shades: string[] }) {
    return (
        <span className="palette-strip" aria-hidden="true">
            {shades.map((color, i) => (
                <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: shades are a fixed-order ramp
                    key={i}
                    className="palette-strip-shade"
                    style={{ backgroundColor: color }}
                />
            ))}
        </span>
    );
}
