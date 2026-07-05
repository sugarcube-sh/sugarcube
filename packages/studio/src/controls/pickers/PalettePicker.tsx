import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover/popover";

export type PaletteOption = {
    name: string;
    shades: string[];
};

type Props = {
    currentName: string;
    options: PaletteOption[];
    onSelect: (name: string) => void;
};

export function PalettePicker({ currentName, options, onSelect }: Props) {
    const [open, setOpen] = useState(false);
    const current = options.find((o) => o.name === currentName);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="select-trigger cluster w-full" data-cluster-wrap="nowrap">
                <PaletteStrip shades={current?.shades ?? []} />
                <span className="font-mono text-sm">{currentName}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="preset-popover palette-picker-popover">
                <div
                    className="preset-list"
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom listbox: options contain buttons and color strips, not plain text
                    role="listbox"
                    tabIndex={0}
                >
                    {options.map((opt) => (
                        <div
                            key={opt.name}
                            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom option with rich button content, not a native <option>
                            role="option"
                            aria-selected={opt.name === currentName}
                        >
                            <button
                                type="button"
                                className="preset-option cluster w-full"
                                data-selected={opt.name === currentName || undefined}
                                onClick={() => {
                                    onSelect(opt.name);
                                    setOpen(false);
                                }}
                            >
                                <PaletteStrip shades={opt.shades} />
                                <span className="ms-auto">{opt.name}</span>
                                <span
                                    className="palette-picker-option-indicator"
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

const STRIP_SHADE_COUNT = 11;

function PaletteStrip({ shades }: { shades: string[] }) {
    const sampled = sampleShades(shades, STRIP_SHADE_COUNT);
    return (
        <span className="palette-strip" aria-hidden="true">
            {sampled.map((color, i) => (
                <span
                    // oxlint-disable-next-line react/no-array-index-key -- shades are a fixed-order ramp
                    key={i}
                    className="palette-strip-shade"
                    style={{ backgroundColor: color }}
                />
            ))}
        </span>
    );
}

function sampleShades(shades: string[], count: number): string[] {
    if (shades.length <= count) return shades;
    return Array.from({ length: count }, (_, i) => {
        const idx = Math.round((i * (shades.length - 1)) / (count - 1));
        return shades[idx] as string;
    });
}
