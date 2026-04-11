import type { StudioConfig } from "@sugarcube-sh/core/client";

/**
 * Panel configuration for the sugarcube landing page tweakpane.
 *
 * This is what would live under `studio.panel` in a real
 * `sugarcube.config.ts`. Co-located here for the landing page because
 * the tweakpane loads tokens from a build-time snapshot, not from a
 * user project's config file.
 *
 * Custom projects will write their own version of this in their
 * `sugarcube.config.ts`. The starter kits ship with a default.
 *
 * Read this file as a document: it describes the editing surface —
 * what the user can tweak, and how each control is wired up.
 */
export const PANEL_CONFIG: StudioConfig = {
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
