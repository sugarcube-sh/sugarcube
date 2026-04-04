import { useEffect, useState } from "react";
import { getCSSVar } from "../hooks/useCSSVariables";

type TokenRowProps = {
    label: string;
    cssVar: string;
    linked: boolean;
    onLinkToggle: () => void;
    onSwatchClick: () => void;
    /** Whether the color picker is expanded below this row */
    expanded?: boolean;
};

export function TokenRow({
    label,
    cssVar,
    linked,
    onLinkToggle,
    onSwatchClick,
    expanded = false,
}: TokenRowProps) {
    const [computedColor, setComputedColor] = useState<string>("");

    // Read computed color on mount and when cssVar changes
    useEffect(() => {
        setComputedColor(getCSSVar(cssVar));
    }, [cssVar]);

    return (
        <div className="tweakpane-token-row" data-linked={linked} data-expanded={expanded}>
            <span className="tweakpane-token-label">{label}</span>
            <button
                type="button"
                className="tweakpane-token-swatch"
                style={{ backgroundColor: computedColor || undefined }}
                onClick={onSwatchClick}
                aria-label={`Edit ${label} color`}
                aria-expanded={expanded}
            />
            <button
                type="button"
                className="tweakpane-token-link"
                onClick={onLinkToggle}
                aria-label={linked ? "Unlink from base palette" : "Link to base palette"}
                title={linked ? "Linked to base" : "Custom"}
            >
                {linked ? "🔗" : "🔓"}
            </button>
        </div>
    );
}
