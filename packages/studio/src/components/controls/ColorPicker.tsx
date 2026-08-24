"use client";

import { useMemo, useRef, useState } from "react";
import { type ColorValue, directColor } from "../../tokens/color-value";
import type { PaletteRamp } from "../../tokens/palettes";
import { useFieldRow } from "../../shell/Field";
import { CommandSearchWrapper } from "../ui/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover/popover";
import { ColorGrid } from "./ColorGrid";
import { FieldTrigger, FieldTriggerContent, FieldTriggerPlaceholder } from "./FieldTrigger";
import { Swatch } from "./Swatch";
import { TokenText } from "./TokenText";

type ColorPickerProps = {
    value: ColorValue | undefined;
    onChange: (value: ColorValue) => void;
    ramps: PaletteRamp[];
    id?: string;
    disabled?: boolean;
};

function filterRamps(ramps: PaletteRamp[], query: string): PaletteRamp[] {
    const q = query.trim().toLowerCase();
    if (!q) return ramps;

    return ramps.flatMap((ramp) => {
        if (ramp.name.toLowerCase().includes(q)) return [ramp];
        const steps = ramp.steps.filter((step) => step.step.toLowerCase().includes(q));
        return steps.length > 0 ? [{ ...ramp, steps }] : [];
    });
}

function findStep(ramps: PaletteRamp[], value: string | undefined) {
    if (!value) return undefined;
    for (const ramp of ramps) {
        const step = ramp.steps.find((s) => s.value === value);
        if (step) return step;
    }
    return undefined;
}

export function ColorPicker({ value, onChange, ramps, id, disabled }: ColorPickerProps) {
    const row = useFieldRow();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [focusSignal, setFocusSignal] = useState(0);

    const terminal = value?.terminal;

    const originalRef = useRef(value);

    function preview(next: string) {
        if (next === terminal) return;
        onChange(directColor(next));
    }

    function unflatten() {
        const original = originalRef.current;
        if (!original || value?.authored === original.authored) return;
        onChange(original);
    }

    function choose(next: string) {
        if (next === originalRef.current?.terminal) unflatten();
        else onChange(directColor(next));
        setOpen(false);
        setQuery("");
    }

    function handleOpenChange(next: boolean) {
        if (next) originalRef.current = value;
        else if (terminal === originalRef.current?.terminal) unflatten();
        setOpen(next);
        if (!next) setQuery("");
    }

    const selected = useMemo(() => findStep(ramps, terminal), [ramps, terminal]);
    const filtered = useMemo(() => filterRamps(ramps, query), [ramps, query]);

    function enterGrid(event: React.KeyboardEvent) {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        setFocusSignal((n) => n + 1);
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <FieldTrigger id={id} disabled={disabled} aria-labelledby={row?.labelId}>
                    <FieldTriggerContent>
                        {selected ? (
                            <>
                                <Swatch color={selected.css} />
                                <TokenText path={selected.value} />
                            </>
                        ) : (
                            <FieldTriggerPlaceholder>Select…</FieldTriggerPlaceholder>
                        )}
                    </FieldTriggerContent>
                </FieldTrigger>
            </PopoverTrigger>

            <PopoverContent align="start" className="picker-popover">
                <div className="command">
                    <CommandSearchWrapper>
                        <input
                            type="text"
                            data-slot="command-input"
                            className="command-input"
                            placeholder="Search…"
                            aria-label="Search colors"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={enterGrid}
                        />
                    </CommandSearchWrapper>

                    {filtered.length === 0 ? (
                        <p className="command-empty">No matches</p>
                    ) : (
                        <div className="command-list">
                            <ColorGrid
                                ramps={filtered}
                                value={terminal}
                                onSelect={choose}
                                onPreview={preview}
                                focusSignal={focusSignal}
                            />
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export type { ColorPickerProps };
