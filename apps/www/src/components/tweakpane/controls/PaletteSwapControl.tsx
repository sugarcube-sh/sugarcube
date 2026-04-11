import type { ColorScaleConfig } from "@sugarcube-sh/core/client";
import { PaletteSwatches } from "../components/PaletteSwatches";
import { useFamilyPalette, useTokenStore } from "../store/TokenStore";
import { familyPaletteSwapUpdates } from "../store/palette-cascade";

type PaletteSwapControlProps = {
    /** Token path prefix whose children reference the palette. */
    family: string;
    /** Available palette names (may be a subset of colorScale.palettes). */
    palettes: string[];
    /** Scale structure (prefix + steps) for the swatch previews. */
    colorScale: ColorScaleConfig;
};

/**
 * Renders a row of palette swatches. Clicking a swatch swaps every
 * token under `family` to reference the selected palette — across all
 * permutations — in one atomic update.
 */
export function PaletteSwapControl({ family, palettes, colorScale }: PaletteSwapControlProps) {
    const setTokens = useTokenStore((state) => state.setTokens);
    const current = useFamilyPalette(family, palettes) ?? palettes[0] ?? "";

    const handleChange = (newPalette: string) => {
        const readToken = useTokenStore.getState().getToken;
        setTokens(familyPaletteSwapUpdates(family, newPalette, palettes, readToken));
    };

    // Preview each palette with the middle step of the scale — a
    // reasonable default (e.g. `500` for a 50-950 scale).
    const previewStep = colorScale.steps[Math.floor(colorScale.steps.length / 2)] ?? "";

    return (
        <PaletteSwatches
            label=""
            value={current}
            onChange={handleChange}
            palettes={palettes}
            prefix={colorScale.prefix}
            previewStep={previewStep}
        />
    );
}
