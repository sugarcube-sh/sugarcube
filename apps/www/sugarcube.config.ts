import type { StudioConfig } from "@sugarcube-sh/core/client";
import { defineConfig } from "@sugarcube-sh/vite";

const studio: StudioConfig = {
    colorScale: {
        prefix: "color",
        palettes: [
            "neutral",
            "slate",
            "zinc",
            "gray",
            "stone",
            "red",
            "orange",
            "amber",
            "yellow",
            "lime",
            "green",
            "emerald",
            "teal",
            "cyan",
            "sky",
            "blue",
            "indigo",
            "violet",
            "purple",
            "fuchsia",
            "pink",
            "rose",
        ],
        steps: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"],
        white: "color.white",
        black: "color.black",
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
            title: "Surfaces",
            bindings: [{ type: "color", token: "color.surface.*" }],
        },
        {
            title: "Text",
            bindings: [{ type: "color", token: "color.text.*" }],
        },
        {
            title: "Fills",
            bindings: [{ type: "color", token: "color.fill.*" }],
        },
        {
            title: "On fills",
            bindings: [{ type: "color", token: "color.on.*" }],
        },
        {
            title: "Borders",
            bindings: [
                {
                    type: "preset",
                    token: "panel.border-width",
                    options: "border.width.*",
                    label: "Panels",
                },
                {
                    type: "preset",
                    token: "form-control.border-width",
                    options: "border.width.*",
                    label: "Form controls",
                },
            ],
        },
        {
            title: "Corners",
            bindings: [
                { type: "preset", token: "panel.radius", options: "radius.*", label: "Panels" },
                {
                    type: "preset",
                    token: "form-control.radius",
                    options: "radius.*",
                    label: "Form controls",
                },
            ],
        },
        {
            title: "Type",
            bindings: [
                { type: "preset", token: "font.body", options: "font.*", label: "body" },
                { type: "preset", token: "font.heading", options: "font.*", label: "headings" },
            ],
        },
        {
            title: "Scale",
            bindings: [
                {
                    type: "scale",
                    token: "size.step.*",
                    scaleType: "exponential",
                    base: "size.step.0",
                },
                {
                    type: "scale",
                    token: "space.*",
                    scaleType: "multipliers",
                    base: "space.sm",
                },
                {
                    type: "scale-linked",
                    token: "container.*",
                    scalesWith: "size.step.*",
                    label: "scale containers",
                },
            ],
        },
        {
            title: "Controls",
            bindings: [{ type: "preset", token: "form-control.font-size", options: "text.*" }],
        },
    ],
};

export default defineConfig({
    resolver: "registry/tokens/starter-kits/fluid/tokens.resolver.json",
    studio,
    utilities: {
        classes: {
            padding: {
                source: "space.*",
                prefix: "p",
                directions: ["all"],
            },
            margin: {
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
            gap: {
                source: "space.*",
                prefix: "gap",
            },
            color: {
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
