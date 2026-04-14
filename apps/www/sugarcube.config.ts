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
            title: "Base",
            type: "palette-swap",
            family: "color.neutral",
        },
        {
            title: "Accent",
            type: "palette-swap",
            family: "color.accent",
        },
        {
            title: "Surfaces",
            bindings: [{ token: "color.surface.*" }],
        },
        {
            title: "Text",
            bindings: [{ token: "color.text.*" }],
        },
        {
            title: "Fills",
            bindings: [{ token: "color.fill.*" }],
        },
        {
            title: "On fills",
            bindings: [{ token: "color.on.*" }],
        },
        {
            title: "Borders",
            bindings: [
                { token: "panel.border-width", options: "border.width.*" },
                { token: "form-control.border-width", options: "border.width.*" },
            ],
        },
        {
            title: "Corners",
            bindings: [
                { token: "panel.radius", options: "radius.*" },
                { token: "form-control.radius", options: "radius.*" },
            ],
        },
        {
            title: "Type",
            bindings: [
                { token: "font.body", options: "font.*", label: "body" },
                { token: "font.heading", options: "font.*", label: "headings" },
            ],
        },
        {
            title: "Scale",
            bindings: [
                { token: "size.step.*", type: "scale", base: "size.step.0" },
                { token: "space.*", type: "scale", base: "space.sm" },
                { token: "container.*", scalesWith: "size.step.*", label: "scale containers" },
            ],
        },
        {
            title: "Controls",
            bindings: [{ token: "form-control.font-size", options: "text.*" }],
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
