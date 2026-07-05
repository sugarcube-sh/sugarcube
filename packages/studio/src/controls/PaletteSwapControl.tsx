import type { ColorScaleConfig } from "@sugarcube-sh/core/client";
import { useCallback, useMemo } from "react";
import {
    useFamilyPalette,
    usePathIndex,
    useTokenStore,
    useTokenStoreApi,
    useVariableName,
} from "../store/hooks";
import { familyPaletteSwapUpdates } from "../tokens/palette";
import { joinTokenPath, lastSegment } from "../tokens/paths";
import { TokenRow } from "./TokenRow";
import { type PaletteOption, PalettePicker } from "./pickers/PalettePicker";

type PaletteSwapControlProps = {
    family: string;
    label?: string;
    palettes: string[];
    colorScale: ColorScaleConfig;
};

export function PaletteSwapControl({
    family,
    label,
    palettes,
    colorScale,
}: PaletteSwapControlProps) {
    const tokenStore = useTokenStoreApi();
    const pathIndex = usePathIndex();
    const setTokens = useTokenStore((state) => state.setTokens);
    const variableName = useVariableName();
    const current = useFamilyPalette(family, palettes) ?? palettes[0] ?? "";

    const options = useMemo(
        () => buildOptions(palettes, colorScale, variableName),
        [palettes, colorScale, variableName],
    );

    const handleChange = useCallback(
        (newPalette: string) => {
            const readToken = tokenStore.getState().getToken;
            setTokens(familyPaletteSwapUpdates(family, newPalette, palettes, readToken, pathIndex));
        },
        [tokenStore, family, palettes, setTokens, pathIndex],
    );

    return (
        <TokenRow label={label ?? lastSegment(family)}>
            <PalettePicker currentName={current} options={options} onSelect={handleChange} />
        </TokenRow>
    );
}

function buildOptions(
    palettes: readonly string[],
    colorScale: ColorScaleConfig,
    variableName: (path: string) => string,
): PaletteOption[] {
    return palettes.map((palette) => ({
        name: palette,
        shades: colorScale.steps.map((step) => {
            const path = joinTokenPath(colorScale.prefix, palette, step);
            return `var(--${variableName(path)})`;
        }),
    }));
}
