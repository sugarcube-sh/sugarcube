import { useEffect, useState } from "react";
import { getCSSVar } from "../hooks/useCSSVariables";

type TokenRowProps = {
  label: string;
  cssVar: string;
  linked: boolean;
  onLinkToggle: () => void;
  onSwatchClick: () => void;
  /** Display value (e.g., "base.100" or "white") */
  displayValue: string;
  /** Whether the color picker is expanded below this row */
  expanded?: boolean;
};

export function TokenRow({
  label,
  cssVar,
  linked,
  onLinkToggle,
  onSwatchClick,
  displayValue,
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
      />
      <span className="tweakpane-token-value">{displayValue}</span>
      <button
        type="button"
        className="tweakpane-token-link"
        onClick={onLinkToggle}
        aria-label={linked ? "Link to base palette" : "Using custom value"}
        title={linked ? "Linked to base palette" : "Custom value"}
      >
        {linked ? "🔗" : "🔓"}
      </button>
    </div>
  );
}
