import type { AliasBinding, PanelBinding, PanelSection } from "@sugarcube-sh/core/client";
import { resolvePanelDefaults } from "@sugarcube-sh/core/client";
import { Swatch, SwatchGroup, representativeShade } from "../components/controls/Swatch";
import { labelForBinding } from "../controls/path-utils";
import { resolveOptions } from "../controls/preset-options";
import { paletteRamps } from "../tokens/palettes";
import { lastSegment } from "../tokens/paths";
import { linkAdapter } from "./adapters/link";
import { paletteSwapAdapter } from "./adapters/palette";
import { colorAdapter, presetAdapter } from "./adapters/token";
import { colorControl, pickerControl, switchControl } from "./control";
import { scaleRows } from "./scale-rows";
import type { ResolveContext, Row } from "./types";

export function withSectionDefaults(section: PanelSection, binding: PanelBinding): PanelBinding {
    if (binding.type !== "alias") return binding;
    return { ...binding, ...resolvePanelDefaults(section, binding) };
}

// Turns a panel binding into the rows it renders as.
export function expand(binding: PanelBinding, ctx: ResolveContext): Row[] {
    switch (binding.type) {
        case "alias":
            return aliasRows(binding, ctx);

        case "scale":
            return scaleRows(binding, ctx);

        case "link":
            return [
                {
                    key: `${binding.token}:link`,
                    label: labelForBinding(binding),
                    controls: [switchControl({}, linkAdapter(binding.token))],
                },
            ];

        case "palette-swap":
            return paletteSwapRows(binding, ctx);
    }
}

function targets(binding: AliasBinding, ctx: ResolveContext): { path: string; label: string }[] {
    if (!binding.token.includes("*")) {
        return [{ path: binding.token, label: labelForBinding(binding) }];
    }

    const matches = ctx.pathIndex.matching(binding.token);
    let selected: readonly string[] = matches;

    if (binding.only) {
        const bySegment = new Map(matches.map((path) => [lastSegment(path), path]));
        selected = binding.only.flatMap((segment) => {
            const path = bySegment.get(segment);
            if (!path) {
                console.warn(
                    `[studio] Skipping "${segment}" in \`only\` for "${binding.token}": no matching token. \`only\` entries must be the last segment of a token path that matches the glob).`,
                );
                return [];
            }
            return [path];
        });
    }

    return selected.map((path) => {
        const segment = lastSegment(path);
        return { path, label: binding.labels?.[segment] ?? segment };
    });
}

function aliasRows(binding: AliasBinding, ctx: ResolveContext): Row[] {
    // A colour is stored as a reference to a palette token and needs its chain followed
    if (binding.from === "colorScale") {
        const props = colorProps(binding, ctx);
        if (!props) return [];
        return targets(binding, ctx).map(({ path, label }) => ({
            key: `${path}:alias`,
            label,
            controls: [colorControl(props, colorAdapter(path))],
        }));
    }

    if (binding.options) {
        const props = optionProps(binding, ctx);
        return targets(binding, ctx).map(({ path, label }) => ({
            key: `${path}:alias`,
            label,
            controls: [pickerControl(props, presetAdapter(path))],
        }));
    }

    console.warn(
        `[studio] Skipping alias "${binding.token}": set \`from: "colorScale"\` or \`options\` on the binding (or its section), otherwise there's nothing to pick from.`,
    );
    return [];
}

function colorProps(binding: AliasBinding, ctx: ResolveContext) {
    if (!ctx.colorScale) {
        console.warn(
            `[studio] Skipping alias "${binding.token}": \`from: "colorScale"\` needs \`studio.colorScale\` in sugarcube config.`,
        );
        return null;
    }
    return { ramps: paletteRamps(ctx.colorScale, ctx) };
}

function optionProps(binding: AliasBinding, ctx: ResolveContext) {
    const options = binding.options!;
    const resolved = resolveOptions(options, ctx.pathIndex, ctx.baseline.resolved);
    return {
        options: resolved.map((option) => ({ value: option.reference, label: option.label })),
    };
}

function paletteSwapRows(
    binding: Extract<PanelBinding, { type: "palette-swap" }>,
    ctx: ResolveContext,
): Row[] {
    const scale = ctx.colorScale;
    if (!scale) {
        console.warn(
            `[studio] Skipping palette-swap for "${binding.family}": add \`studio.colorScale\` to sugarcube config.`,
        );
        return [];
    }

    const palettes = binding.palettes ?? scale.palettes;
    if (palettes.length === 0) {
        console.warn(
            `[studio] Skipping palette-swap for "${binding.family}": set \`palettes\` on the binding or on \`studio.colorScale\`.`,
        );
        return [];
    }

    const ramps = paletteRamps(scale, ctx, { palettes });
    const options = ramps.map((ramp) => ({ value: ramp.name }));
    const shades = new Map(ramps.map((ramp) => [ramp.name, ramp.steps.map((s) => s.css)]));

    // Bare names, not the configured paths: a swap reads and rewrites the palette *segment*
    // inside a reference like {color.neutral.500}, so "color.neutral" would never match.
    const names = ramps.map((ramp) => ramp.name);
    const rampFor = (value: string) => shades.get(value) ?? [];

    return [
        {
            key: `${binding.family}:palette`,
            label: labelForBinding(binding),
            controls: [
                pickerControl(
                    {
                        options,
                        searchable: true,
                        placeholder: "Mixed",
                        renderItem: (option) => (
                            <>
                                <SwatchGroup shades={rampFor(option.value)} />
                                <span>{option.value}</span>
                            </>
                        ),
                        renderValue: (option) => (
                            <>
                                <Swatch color={representativeShade(rampFor(option.value))} />
                                <span>{option.value}</span>
                            </>
                        ),
                    },
                    paletteSwapAdapter(binding.family, names),
                ),
            ],
        },
    ];
}
