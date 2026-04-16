import { type ColorScaleConfig, formatCSSVarName } from "@sugarcube-sh/core/client";
import { useContext, useMemo } from "react";
import { familyPaletteSwapUpdates } from "../../store/palette-cascade";
import { StudioContext, useFamilyPalette, usePathIndex, useTokenStore } from "../store/hooks";
import { TokenRow } from "./TokenRow";
import { joinTokenPath } from "./path-utils";
import { type PaletteOption, PalettePicker } from "./pickers/PalettePicker";

type PaletteSwapControlProps = {
    family: string;
    label?: string;
    palettes: string[];
    colorScale: ColorScaleConfig;
};

/**
 * Renders a palette picker for a whole token family (e.g. "base", "accent"),
 * wrapped in a standard `TokenRow` so it sits flush with other bindings.
 *
 * Selecting a palette rebinds every `${family}.*` token to point at the
 * chosen palette's equivalent step. One logical change, N diffed writes.
 *
 * No per-row Discard — swaps affect many tokens, so the row-level Discard
 * (which targets a single path) would be ambiguous here. Use the footer
 * Discard to revert instead. (TODO if we ever want per-swap discard.)
 */
export function PaletteSwapControl({
    family,
    label,
    palettes,
    colorScale,
}: PaletteSwapControlProps) {
    const ctx = useContext(StudioContext);
    const pathIndex = usePathIndex();
    const setTokens = useTokenStore((state) => state.setTokens);
    const current = useFamilyPalette(family, palettes) ?? palettes[0] ?? "";

    const options = useMemo(() => buildOptions(palettes, colorScale), [palettes, colorScale]);

    const handleChange = (newPalette: string) => {
        if (!ctx) return;
        const readToken = ctx.store.getState().getToken;
        setTokens(familyPaletteSwapUpdates(family, newPalette, palettes, readToken, pathIndex));
    };

    const rowLabel = label ?? family.split(".").pop() ?? family;

    return (
        <TokenRow label={rowLabel}>
            <PalettePicker currentName={current} options={options} onSelect={handleChange} />
        </TokenRow>
    );
}

function buildOptions(palettes: readonly string[], colorScale: ColorScaleConfig): PaletteOption[] {
    return palettes.map((palette) => ({
        name: palette,
        shades: colorScale.steps.map((step) => {
            const path = joinTokenPath(colorScale.prefix, palette, step);
            return `var(--${formatCSSVarName(path)})`;
        }),
    }));
}
