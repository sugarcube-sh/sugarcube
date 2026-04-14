import type { ColorScaleConfig } from "@sugarcube-sh/core/client";
import { useContext } from "react";
import { familyPaletteSwapUpdates } from "../../store/palette-cascade";
import { PaletteSwatches } from "../components/PaletteSwatches";
import { StudioContext, useFamilyPalette, usePathIndex, useTokenStore } from "../store/hooks";

type PaletteSwapControlProps = {
    family: string;
    palettes: string[];
    colorScale: ColorScaleConfig;
};

export function PaletteSwapControl({ family, palettes, colorScale }: PaletteSwapControlProps) {
    const ctx = useContext(StudioContext);
    const pathIndex = usePathIndex();
    const setTokens = useTokenStore((state) => state.setTokens);
    const current = useFamilyPalette(family, palettes) ?? palettes[0] ?? "";

    const handleChange = (newPalette: string) => {
        if (!ctx) return;
        const readToken = ctx.store.getState().getToken;
        setTokens(familyPaletteSwapUpdates(family, newPalette, palettes, readToken, pathIndex));
    };

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
