import {
    type ColorScaleConfig,
    type PanelBinding,
    formatCSSVarName,
} from "@sugarcube-sh/core/client";
import { useState } from "react";
import {
    ColorGrid,
    type ColorSelection,
    colorSelectionToTokenReference,
    tokenReferenceToColorSelection,
} from "../components/ColorGrid";
import { TokenFolder } from "../components/TokenFolder";
import { useToken, useTokenStore } from "../store/hooks";
import { joinTokenPath } from "./path-utils";
import { labelForBinding } from "./resolver";

type ColorTokenControlProps = {
    binding: PanelBinding;
    colorScale: ColorScaleConfig;
};

export function ColorTokenControl({ binding, colorScale }: ColorTokenControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const resetToken = useTokenStore((state) => state.resetToken);
    const [expanded, setExpanded] = useState(false);

    const label = labelForBinding(binding);
    const cssVar = `--${formatCSSVarName(binding.token)}`;

    const whiteRef = colorScale.white ? `{${colorScale.white}}` : undefined;
    const blackRef = colorScale.black ? `{${colorScale.black}}` : undefined;

    const currentValue = tokenReferenceToColorSelection(
        value,
        colorScale.prefix,
        whiteRef,
        blackRef
    );

    const handleSelect = (selection: ColorSelection) => {
        setValue(colorSelectionToTokenReference(selection, colorScale.prefix, whiteRef, blackRef));
    };

    const handleReset = () => {
        resetToken(binding.token);
        setExpanded(false);
    };

    const swatchColor = (palette: string, step: string): string => {
        const path = joinTokenPath(colorScale.prefix, palette, step);
        return `var(--${formatCSSVarName(path)})`;
    };

    return (
        <TokenFolder
            label={label}
            cssVar={cssVar}
            expanded={expanded}
            onToggle={() => setExpanded((prev) => !prev)}
            onReset={handleReset}
            isCustom={currentValue !== undefined}
        >
            <ColorGrid
                palettes={colorScale.palettes}
                steps={colorScale.steps}
                swatchColor={swatchColor}
                currentValue={currentValue}
                onSelect={handleSelect}
                whiteRef={whiteRef}
                blackRef={blackRef}
            />
        </TokenFolder>
    );
}
