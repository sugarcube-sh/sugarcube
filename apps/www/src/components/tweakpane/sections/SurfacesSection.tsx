import { useState } from "react";
import { Section } from "../components/Section";
import { TokenRow } from "../components/TokenRow";
import {
  ColorGrid,
  colorSelectionToCSSValue,
  colorSelectionToDisplayValue,
  type ColorSelection,
} from "../components/ColorGrid";
import {
  Collapsible,
  CollapsibleContent,
} from "@/registry/components/collapsible/react/collapsible";
import { setCSSVar } from "../hooks/useCSSVariables";

type SurfaceConfig = {
  token: string;
  label: string;
};

const SURFACES: SurfaceConfig[] = [
  { token: "default", label: "default" },
  { token: "raised", label: "raised" },
  { token: "lowered", label: "lowered" },
  { token: "lowest", label: "lowest" },
];

export function SurfacesSection() {
  // Track which tokens are linked (following family layer) vs custom
  const [linkedState, setLinkedState] = useState<Record<string, boolean>>(
    Object.fromEntries(SURFACES.map((s) => [s.token, true]))
  );

  // Track custom color selections for each token
  const [customColors, setCustomColors] = useState<Record<string, ColorSelection>>({});

  // Track which row is expanded (only one at a time)
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  const handleSwatchClick = (token: string) => {
    // Toggle expansion - close if already open, open if closed
    setExpandedToken((prev) => (prev === token ? null : token));
  };

  const handleColorSelect = (token: string, selection: ColorSelection) => {
    // Store the custom selection
    setCustomColors((prev) => ({ ...prev, [token]: selection }));
    // Mark as unlocked
    setLinkedState((prev) => ({ ...prev, [token]: false }));
    // Apply the CSS value
    setCSSVar(`--color-surface-${token}`, colorSelectionToCSSValue(selection));
  };

  const handleLinkToggle = (token: string) => {
    const newLinked = !linkedState[token];
    setLinkedState((prev) => ({ ...prev, [token]: newLinked }));

    if (newLinked) {
      // Re-link to family layer
      setCSSVar(`--color-surface-${token}`, `var(--color-neutral-surface-${token})`);
      // Close picker if open
      if (expandedToken === token) {
        setExpandedToken(null);
      }
    } else {
      // Apply custom color if we have one, otherwise expand to show picker
      const customColor = customColors[token];
      if (customColor) {
        setCSSVar(`--color-surface-${token}`, colorSelectionToCSSValue(customColor));
      } else {
        setExpandedToken(token);
      }
    }
  };

  const getDisplayValue = (surface: SurfaceConfig) => {
    if (linkedState[surface.token]) {
      return `neutral.surface.${surface.token}`;
    }
    const customColor = customColors[surface.token];
    if (customColor) {
      return colorSelectionToDisplayValue(customColor);
    }
    return "custom";
  };

  return (
    <Section title="SURFACES">
      {SURFACES.map((surface) => (
        <Collapsible
          key={surface.token}
          open={expandedToken === surface.token}
          onOpenChange={(open: boolean) => setExpandedToken(open ? surface.token : null)}
        >
          <TokenRow
            label={surface.label}
            cssVar={`--color-surface-${surface.token}`}
            linked={linkedState[surface.token] ?? true}
            onLinkToggle={() => handleLinkToggle(surface.token)}
            onSwatchClick={() => handleSwatchClick(surface.token)}
            displayValue={getDisplayValue(surface)}
            expanded={expandedToken === surface.token}
          />
          <CollapsibleContent>
            <ColorGrid
              currentValue={customColors[surface.token]}
              onSelect={(selection) => handleColorSelect(surface.token, selection)}
            />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </Section>
  );
}
