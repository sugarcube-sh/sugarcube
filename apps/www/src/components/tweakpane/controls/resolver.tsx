import type {
    BindingSection,
    ColorScaleConfig,
    PaletteSwapSection,
    PanelBinding,
    PanelSection,
} from "@sugarcube-sh/core/client";
import type { ReactNode } from "react";
import { getTokenType, tokenPathsMatching } from "../store/TokenStore";
import { ColorTokenControl } from "./ColorTokenControl";
import { DropdownControl } from "./DropdownControl";
import { PaletteSwapControl } from "./PaletteSwapControl";
import { PresetControl } from "./PresetControl";
import { ScaleControl } from "./ScaleControl";
import { ScaleLinkedControl } from "./ScaleLinkedControl";

/**
 * Shared context passed to every control. Contains config-level data
 * that individual bindings may need (palettes, steps, prefix).
 */
export type ControlContext = {
    colorScale: ColorScaleConfig | undefined;
};

/**
 * Render the content of a section. Dispatches on the section type
 * and, for binding sections, resolves each binding to a control.
 */
export function renderSectionContent(section: PanelSection, ctx: ControlContext): ReactNode {
    if (section.type === "palette-swap") {
        return renderPaletteSwapSection(section, ctx);
    }
    return renderBindingSection(section, ctx);
}

function renderPaletteSwapSection(section: PaletteSwapSection, ctx: ControlContext): ReactNode {
    const colorScale = ctx.colorScale;
    if (!colorScale) {
        // eslint-disable-next-line no-console
        console.warn(
            `[panel] palette-swap section "${section.title}" needs studio.colorScale in config`
        );
        return null;
    }
    const palettes = section.palettes ?? colorScale.palettes;
    if (palettes.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(`[panel] palette-swap section "${section.title}" has no palettes configured`);
        return null;
    }
    return (
        <PaletteSwapControl family={section.family} palettes={palettes} colorScale={colorScale} />
    );
}

function renderBindingSection(section: BindingSection, ctx: ControlContext): ReactNode {
    return section.bindings.map((binding, index) => renderBinding(binding, ctx, index));
}

/**
 * Resolve a single binding to a rendered control. Expands glob patterns
 * in the token path to one control per match.
 */
function renderBinding(binding: PanelBinding, ctx: ControlContext, key: number): ReactNode {
    // Scale override: treat the matching tokens as a single group.
    if (binding.type === "scale") {
        return <ScaleControl key={key} binding={binding} />;
    }

    // scalesWith: toggle linking this group to another scale.
    if (binding.scalesWith) {
        return <ScaleLinkedControl key={key} binding={binding} />;
    }

    // Glob in the token path: expand to one control per match.
    if (binding.token.includes("*")) {
        const matches = tokenPathsMatching(binding.token);
        return matches.map((path, i) =>
            renderSingleTokenBinding({ ...binding, token: path }, ctx, `${key}-${i}`)
        );
    }

    return renderSingleTokenBinding(binding, ctx, key);
}

function renderSingleTokenBinding(
    binding: PanelBinding,
    ctx: ControlContext,
    key: string | number
): ReactNode {
    // Bindings with `options` → preset picker or dropdown.
    if (binding.options) {
        const tokenType = getTokenType(binding.token);
        // Font family tokens (and text tokens used for font-size) get a
        // dropdown; everything else gets preset buttons.
        if (tokenType === "fontFamily") {
            return <DropdownControl key={key} binding={binding} />;
        }
        return <PresetControl key={key} binding={binding} />;
    }

    // No options → infer control from $type.
    const tokenType = getTokenType(binding.token);
    if (tokenType === "color") {
        if (!ctx.colorScale) {
            // eslint-disable-next-line no-console
            console.warn(
                `[panel] color binding "${binding.token}" needs studio.colorScale in config`
            );
            return null;
        }
        return <ColorTokenControl key={key} binding={binding} colorScale={ctx.colorScale} />;
    }

    // Unhandled $type — surface it for debugging rather than silently skipping.
    // eslint-disable-next-line no-console
    console.warn(
        `[panel] binding "${binding.token}" has $type="${tokenType}" but no control is registered for it`
    );
    return null;
}

/**
 * Derive a human-readable label for a binding. Uses the explicit
 * `label` if provided, otherwise the last non-wildcard segment of
 * the token path.
 */
export function labelForBinding(binding: PanelBinding): string {
    if (binding.label) return binding.label;
    let path = binding.token;
    // Strip trailing glob segments: `container.*` → `container`
    while (path.endsWith(".*")) path = path.slice(0, -2);
    const lastDot = path.lastIndexOf(".");
    return lastDot === -1 ? path : path.substring(lastDot + 1);
}
