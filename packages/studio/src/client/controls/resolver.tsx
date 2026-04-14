import type {
    BindingSection,
    ColorScaleConfig,
    PaletteSwapSection,
    PanelBinding,
    PanelSection,
} from "@sugarcube-sh/core/client";
import type { ReactNode } from "react";
import type { PathIndex } from "../../store/path-index";
import { ColorTokenControl } from "./ColorTokenControl";
import { DropdownControl } from "./DropdownControl";
import { PaletteSwapControl } from "./PaletteSwapControl";
import { PresetControl } from "./PresetControl";
import { ScaleControl } from "./ScaleControl";
import { ScaleLinkedControl } from "./ScaleLinkedControl";

export type ControlContext = {
    colorScale: ColorScaleConfig | undefined;
    pathIndex: PathIndex;
};

export function renderSectionContent(section: PanelSection, ctx: ControlContext): ReactNode {
    if (section.type === "palette-swap") {
        return renderPaletteSwapSection(section, ctx);
    }
    return renderBindingSection(section, ctx);
}

function renderPaletteSwapSection(section: PaletteSwapSection, ctx: ControlContext): ReactNode {
    const colorScale = ctx.colorScale;
    if (!colorScale) {
        console.warn(
            `[studio] palette-swap section "${section.title}" needs studio.colorScale in config`
        );
        return null;
    }
    const palettes = section.palettes ?? colorScale.palettes;
    if (palettes.length === 0) {
        console.warn(`[studio] palette-swap section "${section.title}" has no palettes configured`);
        return null;
    }
    return (
        <PaletteSwapControl family={section.family} palettes={palettes} colorScale={colorScale} />
    );
}

function renderBindingSection(section: BindingSection, ctx: ControlContext): ReactNode {
    return section.bindings.map((binding, index) => renderBinding(binding, ctx, index));
}

function renderBinding(binding: PanelBinding, ctx: ControlContext, key: number): ReactNode {
    if (binding.type === "scale") {
        return <ScaleControl key={key} binding={binding} />;
    }

    if (binding.scalesWith) {
        return <ScaleLinkedControl key={key} binding={binding} />;
    }

    if (binding.token.includes("*")) {
        const matches = ctx.pathIndex.matching(binding.token);
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
    if (binding.options) {
        const tokenType = ctx.pathIndex.getType(binding.token);
        if (tokenType === "fontFamily") {
            return <DropdownControl key={key} binding={binding} />;
        }
        return <PresetControl key={key} binding={binding} />;
    }

    const tokenType = ctx.pathIndex.getType(binding.token);
    if (tokenType === "color") {
        if (!ctx.colorScale) {
            console.warn(
                `[studio] color binding "${binding.token}" needs studio.colorScale in config`
            );
            return null;
        }
        return <ColorTokenControl key={key} binding={binding} colorScale={ctx.colorScale} />;
    }

    console.warn(
        `[studio] binding "${binding.token}" has $type="${tokenType}" but no control is registered for it`
    );
    return null;
}

export function labelForBinding(binding: PanelBinding): string {
    if (binding.label) return binding.label;
    let path = binding.token;
    while (path.endsWith(".*")) path = path.slice(0, -2);
    const lastDot = path.lastIndexOf(".");
    return lastDot === -1 ? path : path.substring(lastDot + 1);
}
