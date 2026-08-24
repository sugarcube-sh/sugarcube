import type { StudioConfig } from "@sugarcube-sh/core/client";
import { defineConfig } from "@sugarcube-sh/vite";

const studio: StudioConfig = {
    colorScale: {
        palettes: [
            "color.neutral",
            "color.slate",
            "color.zinc",
            "color.gray",
            "color.stone",
            "color.red",
            "color.orange",
            "color.amber",
            "color.yellow",
            "color.lime",
            "color.green",
            "color.emerald",
            "color.teal",
            "color.cyan",
            "color.sky",
            "color.blue",
            "color.indigo",
            "color.violet",
            "color.purple",
            "color.fuchsia",
            "color.pink",
            "color.rose",
            "color.white",
            "color.black",
        ],
    },
    panel: [
        {
            title: "Palettes",
            bindings: [
                { type: "palette-swap", family: "color.neutral", label: "Base" },
                { type: "palette-swap", family: "color.accent", label: "Accent" },
            ],
        },
        {
            title: "Text",
            from: "colorScale",
            bindings: [{ type: "alias", token: "color.neutral.text.*" }],
        },
        {
            title: "Surfaces",
            from: "colorScale",
            bindings: [{ type: "alias", token: "color.neutral.surface.*" }],
        },
        {
            title: "Fills",
            from: "colorScale",
            bindings: [{ type: "alias", token: "color.neutral.fill.*" }],
        },
        {
            title: "On fills",
            from: "colorScale",
            bindings: [{ type: "alias", token: "color.neutral.on.*" }],
        },
        {
            title: "Borders",
            options: "border.width.*",
            bindings: [
                { type: "alias", token: "panel.border-width", label: "Panels" },
                { type: "alias", token: "form-control.border-width", label: "Form controls" },
            ],
        },
        {
            title: "Corners",
            options: "radius.*",
            bindings: [
                { type: "alias", token: "panel.radius", label: "Panels" },
                { type: "alias", token: "form-control.radius", label: "Form controls" },
            ],
        },
        {
            title: "Type",
            options: "font.*",
            bindings: [
                { type: "alias", token: "font.body", label: "body" },
                { type: "alias", token: "font.heading", label: "headings" },
            ],
        },
        {
            title: "Type scale",
            bindings: [
                { type: "scale", token: "size.step.*", base: "size.step.0" },
                {
                    type: "link",
                    token: "container.*",
                    scalesWith: "size.step.*",
                    label: "Scale containers",
                },
            ],
        },
        {
            title: "Space scale",
            bindings: [{ type: "scale", token: "space.*", base: "space.sm" }],
        },
        {
            title: "Controls",
            options: "text.*",
            bindings: [{ type: "alias", token: "form-control.font-size" }],
        },
    ],
};

export default defineConfig({
    resolver: "registry/tokens/starter-kits/fluid/tokens.resolver.json",
    studio,
    utilities: {
        classes: {
            "padding": {
                source: "space.*",
                prefix: "p",
                directions: ["all"],
            },
            "margin": {
                source: "space.*",
                prefix: "m",
                directions: ["all"],
            },
            "--flow-space": {
                source: "space.*",
                prefix: "flow-space",
            },
            "--region-space": {
                source: "space.*",
                prefix: "region-space",
            },
            "--cluster-gap": {
                source: "space.*",
                prefix: "cluster-gap",
            },
            "--switcher-gap": {
                source: "space.*",
                prefix: "switcher-gap",
            },
            "--grid-gap": {
                source: "space.*",
                prefix: "grid-gap",
            },
            "--wrapper-max-width": {
                source: "container.*",
                prefix: "wrapper-max-width",
            },
            "gap": {
                source: "space.*",
                prefix: "gap",
            },
            "color": {
                source: "color.*",
                prefix: "text",
                stripDuplicates: true,
            },
            "background-color": {
                source: "color.*",
                prefix: "bg",
            },
            "font-size": {
                source: "text.*",
            },
            "font-weight": {
                source: "font.weight.*",
                prefix: "font-weight",
            },
            "letter-spacing": {
                source: "tracking.*",
            },
            "border-radius": {
                source: "radius.*",
                prefix: "rounded",
            },
        },
    },
});
