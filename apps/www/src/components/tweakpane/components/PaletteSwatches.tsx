import { formatCSSVarName } from "@sugarcube-sh/core/client";
import { useCallback } from "react";
import { joinTokenPath } from "../controls/path-utils";
import { useRovingIndex } from "../hooks/useRovingIndex";

type PaletteSwatchesProps = {
    label: string;
    value: string;
    onChange: (palette: string) => void;
    /** Which palettes to show. */
    palettes: readonly string[];
    /**
     * The token path prefix where palettes live (e.g. `"color"`).
     * Combined with the palette name and `previewStep` to build the
     * CSS variable name each swatch previews.
     */
    prefix: string;
    /** Which scale step to use for the swatch preview. */
    previewStep: string;
};

export function PaletteSwatches({
    label,
    value,
    onChange,
    palettes,
    prefix,
    previewStep,
}: PaletteSwatchesProps) {
    const onActivate = useCallback(
        (index: number) => {
            const palette = palettes[index];
            if (palette) onChange(palette);
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
                {palettes.map((palette, i) => {
                    const path = joinTokenPath(prefix, palette, previewStep);
                    const cssVar = `--${formatCSSVarName(path)}`;
                    return (
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
                            style={{ backgroundColor: `var(${cssVar})` }}
                            onClick={() => onChange(palette)}
                        />
                    );
                })}
            </div>
            <span className="tweakpane-palette-value">{value}</span>
        </div>
    );
}
