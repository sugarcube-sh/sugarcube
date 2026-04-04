import { useCallback } from "react";
import { CORNER_PRESETS, type CornerPreset } from "../data/palettes";
import { useRovingIndex } from "../hooks/useRovingIndex";

type CornerPresetsProps = {
    value: CornerPreset;
    onChange: (preset: CornerPreset) => void;
};

/** SVG border-radius values for each preset (top-right corner preview) */
const CORNER_RADII: Record<CornerPreset, number> = {
    sharp: 0,
    subtle: 3,
    rounded: 8,
    pill: 16,
};

const PRESETS = Object.keys(CORNER_PRESETS) as CornerPreset[];

function CornerIcon({ preset, selected }: { preset: CornerPreset; selected: boolean }) {
    const r = CORNER_RADII[preset];
    const size = 36;
    const inset = 2;
    const boxSize = size - inset * 2;

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            aria-hidden="true"
        >
            <rect
                x={inset}
                y={inset}
                width={boxSize}
                height={boxSize}
                rx={r}
                ry={r}
                fill={selected ? "var(--tp-border)" : "transparent"}
                stroke={selected ? "var(--tp-text)" : "var(--tp-text-quiet)"}
                strokeWidth={1.5}
            />
        </svg>
    );
}

export function CornerPresets({ value, onChange }: CornerPresetsProps) {
    const onActivate = useCallback(
        (index: number) => {
            onChange(PRESETS[index]);
        },
        [onChange]
    );

    const { containerProps } = useRovingIndex({
        count: PRESETS.length,
        onActivate,
    });

    const selectedIndex = PRESETS.indexOf(value);

    return (
        <div
            className="tweakpane-corner-buttons"
            role="radiogroup"
            aria-label="Corner style"
            {...containerProps}
        >
            {PRESETS.map((preset, i) => (
                <button
                    key={preset}
                    type="button"
                    role="radio"
                    aria-checked={value === preset}
                    aria-label={preset}
                    className="tweakpane-corner-button"
                    data-selected={value === preset}
                    tabIndex={i === selectedIndex ? 0 : -1}
                    onClick={() => onChange(preset)}
                >
                    <CornerIcon preset={preset} selected={value === preset} />
                </button>
            ))}
        </div>
    );
}
