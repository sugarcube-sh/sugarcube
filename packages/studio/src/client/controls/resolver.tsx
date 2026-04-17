import type {
    ColorBinding,
    ColorScaleConfig,
    PanelBinding,
    PanelSection,
    PresetBinding,
} from "@sugarcube-sh/core/client";
import type { ReactNode } from "react";
import type { PathIndex } from "../../store/path-index";
import { ColorTokenControl } from "./ColorTokenControl";
import { PaletteSwapControl } from "./PaletteSwapControl";
import { PresetControl } from "./PresetControl";
import { ScaleControl } from "./ScaleControl";
import { ScaleLinkedControl } from "./ScaleLinkedControl";
import { lastSegment } from "./path-utils";

export type ControlContext = {
    colorScale: ColorScaleConfig | undefined;
    pathIndex: PathIndex;
};

export function renderSectionContent(section: PanelSection, ctx: ControlContext): ReactNode {
    return section.bindings.map((binding, index) => renderBinding(binding, ctx, index));
}

function renderBinding(binding: PanelBinding, ctx: ControlContext, key: number): ReactNode {
    switch (binding.type) {
        case "palette-swap":
            return renderPaletteSwap(binding, ctx, key);
        case "scale":
            return <ScaleControl key={key} binding={binding} />;
        case "scale-linked":
            return <ScaleLinkedControl key={key} binding={binding} />;
        case "color":
            return renderExpanded(binding, ctx, key, (b, k) => renderColor(b, ctx, k));
        case "preset":
            return renderExpanded(binding, ctx, key, (b, k) => (
                <PresetControl key={k} binding={b} />
            ));
    }
}

/**
 * Expand a glob token to one control per matching path.
 * Non-glob bindings render as-is.
 */
function renderExpanded<B extends { token: string }>(
    binding: B,
    ctx: ControlContext,
    key: number,
    render: (binding: B, key: string | number) => ReactNode
): ReactNode {
    if (!binding.token.includes("*")) return render(binding, key);
    const matches = ctx.pathIndex.matching(binding.token);
    return matches.map((path, i) => render({ ...binding, token: path }, `${key}-${i}`));
}

function renderColor(binding: ColorBinding, ctx: ControlContext, key: string | number): ReactNode {
    if (!ctx.colorScale) {
        console.warn(`[studio] color binding "${binding.token}" needs studio.colorScale in config`);
        return null;
    }
    return <ColorTokenControl key={key} binding={binding} colorScale={ctx.colorScale} />;
}

function renderPaletteSwap(
    binding: Extract<PanelBinding, { type: "palette-swap" }>,
    ctx: ControlContext,
    key: number
): ReactNode {
    if (!ctx.colorScale) {
        console.warn(
            `[studio] palette-swap binding for "${binding.family}" needs studio.colorScale in config`
        );
        return null;
    }
    const palettes = binding.palettes ?? ctx.colorScale.palettes;
    if (palettes.length === 0) {
        console.warn(
            `[studio] palette-swap binding for "${binding.family}" has no palettes configured`
        );
        return null;
    }
    return (
        <PaletteSwapControl
            key={key}
            family={binding.family}
            label={binding.label}
            palettes={palettes}
            colorScale={ctx.colorScale}
        />
    );
}

/**
 * Derive the row label for a binding — uses `label` when provided,
 * otherwise falls back to the last path segment of `token` (or `family`
 * for palette-swap).
 */
export function labelForBinding(binding: PanelBinding): string {
    if (binding.label) return binding.label;
    const path = binding.type === "palette-swap" ? binding.family : binding.token;
    return lastSegment(path);
}
