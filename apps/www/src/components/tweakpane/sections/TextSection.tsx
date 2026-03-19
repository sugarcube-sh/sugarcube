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

type TextConfig = {
  token: string;
  label: string;
};

const TEXT_TOKENS: TextConfig[] = [
  { token: "normal", label: "body" },
  { token: "quiet", label: "muted" },
  { token: "link", label: "link" },
];

export function TextSection() {
  // Track which tokens are linked (following family layer) vs custom
  const [linkedState, setLinkedState] = useState<Record<string, boolean>>(
    Object.fromEntries(TEXT_TOKENS.map((t) => [t.token, true]))
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
    setCSSVar(`--color-text-${token}`, colorSelectionToCSSValue(selection));
  };

  const handleLinkToggle = (token: string) => {
    const newLinked = !linkedState[token];
    setLinkedState((prev) => ({ ...prev, [token]: newLinked }));

    if (newLinked) {
      // Re-link to family layer
      setCSSVar(`--color-text-${token}`, `var(--color-neutral-text-${token})`);
      // Close picker if open
      if (expandedToken === token) {
        setExpandedToken(null);
      }
    } else {
      // Apply custom color if we have one, otherwise expand to show picker
      const customColor = customColors[token];
      if (customColor) {
        setCSSVar(`--color-text-${token}`, colorSelectionToCSSValue(customColor));
      } else {
        setExpandedToken(token);
      }
    }
  };

  const getDisplayValue = (text: TextConfig) => {
    if (linkedState[text.token]) {
      return `neutral.text.${text.token}`;
    }
    const customColor = customColors[text.token];
    if (customColor) {
      return colorSelectionToDisplayValue(customColor);
    }
    return "custom";
  };

  return (
    <Section title="TEXT">
      {TEXT_TOKENS.map((text) => (
        <Collapsible
          key={text.token}
          open={expandedToken === text.token}
          onOpenChange={(open: boolean) => setExpandedToken(open ? text.token : null)}
        >
          <TokenRow
            label={text.label}
            cssVar={`--color-text-${text.token}`}
            linked={linkedState[text.token] ?? true}
            onLinkToggle={() => handleLinkToggle(text.token)}
            onSwatchClick={() => handleSwatchClick(text.token)}
            displayValue={getDisplayValue(text)}
            expanded={expandedToken === text.token}
          />
          <CollapsibleContent>
            <ColorGrid
              currentValue={customColors[text.token]}
              onSelect={(selection) => handleColorSelect(text.token, selection)}
            />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </Section>
  );
}
