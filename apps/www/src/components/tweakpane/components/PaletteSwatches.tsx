import { useCallback, useEffect, useState } from "react";
import { ALL_PALETTES, type Palette } from "../data/palettes";
import { getCSSVar } from "../hooks/useCSSVariables";
import { useRovingIndex } from "../hooks/useRovingIndex";

type PaletteSwatchesProps = {
    label: string;
    value: Palette;
    onChange: (palette: Palette) => void;
    /** Which palettes to show. Defaults to all. */
    palettes?: readonly Palette[];
    /** Which scale step to use for the swatch preview. Defaults to "500". */
    previewStep?: string;
};

export function PaletteSwatches({
    label,
    value,
    onChange,
    palettes = ALL_PALETTES,
    previewStep = "500",
}: PaletteSwatchesProps) {
    const [colors, setColors] = useState<Record<string, string>>({});

    useEffect(() => {
        const computed: Record<string, string> = {};
        for (const palette of palettes) {
            computed[palette] = getCSSVar(`--color-${palette}-${previewStep}`);
        }
        setColors(computed);
    }, [palettes, previewStep]);

    const onActivate = useCallback(
        (index: number) => {
            onChange(palettes[index]);
        },
        [palettes, onChange]
    );

    const { containerProps } = useRovingIndex({
        count: palettes.length,
        onActivate,
    });

    const selectedIndex = palettes.indexOf(value);

    return (
        <div className="tweakpane-palette-swatches">
            {label && <span className="tweakpane-palette-label">{label}</span>}
            <div
                className="tweakpane-palette-row"
                role="radiogroup"
                aria-label={label || "Palette"}
                {...containerProps}
            >
                {palettes.map((palette, i) => (
                    <button
                        key={palette}
                        type="button"
                        role="radio"
                        aria-checked={value === palette}
                        aria-label={palette}
                        className="tweakpane-swatch"
                        data-palette={palette}
                        data-selected={value === palette}
                        tabIndex={i === selectedIndex ? 0 : -1}
                        style={{ backgroundColor: colors[palette] || undefined }}
                        onClick={() => onChange(palette)}
                    />
                ))}
            </div>
            <span className="tweakpane-palette-value">{value}</span>
        </div>
    );
}
