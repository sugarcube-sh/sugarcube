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
import { useToken, useTokenStore } from "../store/TokenStore";
import { joinTokenPath } from "./path-utils";
import { labelForBinding } from "./resolver";

type ColorTokenControlProps = {
    binding: PanelBinding;
    colorScale: ColorScaleConfig;
};

/**
 * Color picker control for a single color-typed token.
 *
 * Renders a collapsible `TokenFolder` with a swatch preview; expanding
 * it reveals a `ColorGrid` of the available palettes × steps. Picking
 * a swatch writes a DTCG reference like `{color.blue.500}` to the
 * token, which the pipeline resolves on the next run.
 *
 * Fully driven by `colorScale` from config — no hardcoded palette
 * names, steps, or prefix.
 */
export function ColorTokenControl({ binding, colorScale }: ColorTokenControlProps) {
    const [value, setValue] = useToken<string>(binding.token);
    const resetToken = useTokenStore((state) => state.resetToken);
    const [expanded, setExpanded] = useState(false);

    const label = labelForBinding(binding);
    const cssVar = `--${formatCSSVarName(binding.token)}`;

    // Wrap the optional white/black token paths as DTCG references.
    // If the config doesn't provide them, ColorGrid won't show the
    // corresponding escape-hatch swatches.
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

    // Build the swatch background color — walks the palette/step pair
    // through the same convention the pipeline uses when generating
    // CSS, so whatever variable name sugarcube emits is the one we read.
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
