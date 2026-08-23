import type { PropertyUtilityConfig } from "./utilities.js";

export type ColorFallbackStrategy = "native" | "polyfill";

/**
 * Callback that maps a token's DTCG path to its final CSS variable name
 * (without the leading `--`). Escape hatch for users who need full control —
 * overrides `variables.prefix` entirely when set.
 *
 * @param path - The DTCG path of the token (e.g. `"color.brandPrimary"`).
 * @returns The CSS variable name without the leading `--`.
 *
 * @example
 * // Kebab-case everything, with a prefix
 * variableName: (path) => `ds-${path.replaceAll(".", "-").toLowerCase()}`
 */
export type VariableNameFn = (path: string) => string;

/**
 * A permutation defines a single resolved token set and how to output it as CSS.
 * Each permutation specifies a resolver input (which modifier contexts to use)
 * and a CSS selector to wrap the output in.
 *
 * Aligned with the DTCG resolver spec's "permutation" concept:
 * each permutation maps 1:1 to a resolver input.
 */
export type Permutation = {
    /**
     * Resolver input - map of modifier names to context values.
     * Missing modifiers use their defaults (per DTCG spec).
     * @example { theme: "dark" }
     * @example { brand: "ocean", theme: "dark" }
     */
    input: Record<string, string>;
    /**
     * CSS selector(s) for this permutation's output.
     * Can be a string or array of strings - multiple selectors get comma-joined.
     * @example ":root"
     * @example "[data-theme=\"dark\"]"
     * @example ["[data-color-mode=dark][data-dark-theme=dark]", "[data-color-mode=auto][data-dark-theme=dark]"]
     */
    selector: string | string[];
    /** Optional at-rule wrapper, e.g. "@media (prefers-color-scheme: dark)" */
    atRule?: string;
    /**
     * Optional output path for this permutation's CSS file.
     * When set, this permutation is written to its own file instead of the default variables path.
     * @example "dist/brand-one.css"
     */
    path?: string;
};

export type FluidConfig = {
    min: number;
    max: number;
};

export type TransformsConfig = {
    fluid?: FluidConfig;
    colorFallbackStrategy?: ColorFallbackStrategy;
};

export type UtilityClassesConfig = Record<string, PropertyUtilityConfig | PropertyUtilityConfig[]>;

/**
 * Configuration for CSS variables output.
 */
export interface VariablesConfig {
    /**
     * Default output path for the CSS variables file.
     * @example "src/styles/tokens.css"
     */
    path?: string;

    /**
     * Prefix prepended to every generated CSS variable name.
     *
     * @example
     * // prefix: "ds"
     * // color.brandPrimary → --ds-color-brandPrimary
     */
    prefix?: string;

    /**
     * Full-control callback for computing the CSS variable name from a
     * token path. Overrides `prefix` entirely when set — the user owns
     * both prefixing and case-handling.
     *
     * Returns the name *without* the leading `--`.
     *
     * @example
     * variableName: (path) => `ds-${path.replaceAll(".", "-").toLowerCase()}`
     */
    variableName?: VariableNameFn;

    /**
     * CSS cascade layer name for variables.
     * When set, output is wrapped in @layer block.
     * @example "tokens"
     */
    layer?: string;

    /**
     * Token transformation options.
     */
    transforms?: {
        /**
         * Viewport range for fluid typography calculations.
         * Tokens with $type: "fluidDimension" will scale between min and max viewport widths.
         */
        fluid?: FluidConfig;
        /**
         * How to handle colors that can't be represented in sRGB.
         * - "native": Use CSS color functions directly (modern browsers only)
         * - "polyfill": Generate fallback values for older browsers
         */
        colorFallbackStrategy?: ColorFallbackStrategy;
    };

    /**
     * Permutations define how modifier contexts map to CSS selectors.
     * Each permutation specifies a resolver input and a CSS selector.
     *
     * When no permutations are defined, sugarcube resolves with all defaults
     * and outputs to :root.
     *
     * @example
     * permutations: [
     *   { input: { theme: "light" }, selector: ":root" },
     *   { input: { theme: "dark" }, selector: "[data-theme=\"dark\"]" },
     *   { input: { theme: "dark" }, selector: ":root", atRule: "@media (prefers-color-scheme: dark)" },
     * ]
     */
    permutations?: Permutation[];

    /**
     * Re-emit dependent variables on modifier selectors.
     *
     * @default false
     */
    propagateDependents?: boolean;
}

/**
 * Configuration for utility classes output.
 */
export interface UtilitiesOutputConfig {
    /**
     * Output path for the utility classes CSS file.
     * @example "src/styles/utilities.css"
     */
    path?: string;

    /**
     * CSS cascade layer name for utilities.
     * When set, output is wrapped in @layer block.
     * @example "utilities"
     */
    layer?: string;

    /**
     * Utility class generation configuration.
     * Maps CSS property names to token sources and options.
     *
     * @example
     * classes: {
     *   "background-color": { source: "color.background.*" },
     *   "padding": { source: "space.*", directions: ["x", "y", "all"] }
     * }
     */
    classes?: UtilityClassesConfig;
}

/**
 * A named source of choices declared elsewhere in `studio` config. Today the only one is
 * the palette scale; the control a row renders follows from the source rather than being
 * chosen separately.
 */
export type PanelSource = "colorScale";

/**
 * An alias binding — points a token at one of a set of other tokens. This covers every
 * "pick a value from a constrained set" row: colours, radii, border widths, fonts.
 *
 * Exactly one of `from` and `options` must resolve, on the binding or inherited from its
 * section. Nothing is inferred — a binding supplying neither, or both, fails at config load.
 *
 * @example
 * { type: "alias", token: "panel.radius", label: "Panels" }          // inherits from section
 * { type: "alias", token: "color.surface.*", from: "colorScale" }    // the palette scale
 */
export type AliasBinding = {
    type: "alias";
    /** Token path or glob pattern (e.g. `"panel.radius"` or `"color.surface.*"`). */
    token: string;
    /**
     * Where the choices come from, when they aren't an explicit set. Names a key in
     * `studio` config rather than a token path. Mutually exclusive with `options`.
     */
    from?: PanelSource;
    /**
     * An explicit set of choices — glob pattern, or a label-to-reference map.
     * Mutually exclusive with `from`. Either may be inherited from the section.
     */
    options?: string | Record<string, string>;
    /** Label for a single-token binding — default is the token's last segment. */
    label?: string;
    /** Labels for a glob binding, keyed by each match's last segment. */
    labels?: Record<string, string>;
    /**
     * For a glob binding, the last segments to render, in this order. Both filters and
     * orders; without it, matches render in token order.
     */
    only?: string[];
};

/**
 * A scale binding — declares a panel control for a group of fluid tokens.
 *
 * The studio dispatches purely on whether a recipe (`sh.sugarcube.scale`
 * extension) is authored at the bound path:
 * - Recipe present → recipe-aware controls; the recipe's `mode` field
 *   tells the studio whether to render exponential or multipliers UI.
 * - No recipe → bulk controls (base + spread) and per-step inputs render
 *   together for direct editing of the concrete tokens.
 *
 * @example
 * { type: "scale", token: "size.step.*", base: "size.step.0" }
 */
export type ScaleBinding = {
    type: "scale";
    /** Glob pattern (or concrete path) matching the scale's tokens. */
    token: string;
    /** Optional label override. */
    label?: string;
    /**
     * The path of the step that anchors the bulk slider. The slider's
     * value directly controls this step's max-viewport value, and other
     * steps adjust proportionally.
     */
    base?: string;
    /** Bulk slider minimum. */
    min?: number;
    /** Bulk slider maximum. */
    max?: number;
    /** Bulk slider step increment. */
    step?: number;
};

/**
 * A link binding — a family of tokens that follows another scale's transform. Toggling it
 * links the follower on/off; when on, the follower's values are derived from the source
 * scale's base/spread multipliers.
 *
 * Its value is a boolean and its editor is a switch, so it is named for what it is rather
 * than for the scale it happens to follow.
 *
 * @example
 * { type: "link", token: "container.*", scalesWith: "size.step.*" }
 */
export type LinkBinding = {
    type: "link";
    /** Glob pattern matching the follower tokens. */
    token: string;
    /** Glob pattern of the scale whose transform is being mirrored. */
    scalesWith: string;
    /** Optional label override. */
    label?: string;
};

/**
 * A palette-swap binding — swaps which palette family a set of semantic tokens
 * references by replacing the palette name in each token's `$value` reference.
 *
 * Uses the top-level `studio.colorScale.palettes` list as the set of
 * available swap targets. An optional `palettes` field can narrow that list.
 *
 * @example
 * {
 *   title: "Palette",
 *   bindings: [
 *     { type: "palette-swap", family: "color.neutral", label: "Base" },
 *     { type: "palette-swap", family: "color.accent",  label: "Accent" },
 *   ],
 * }
 */
export type PaletteSwapBinding = {
    type: "palette-swap";
    /** Token path prefix whose children will have their palette reference swapped. */
    family: string;
    /** Optional label shown in the row (defaults to the family's last segment). */
    label?: string;
    /**
     * Optional override of the palette list for this binding.
     * Defaults to `studio.colorScale.palettes`.
     */
    palettes?: string[];
};

/**
 * A single binding inside a panel section. Discriminated by `type`:
 *  - `"alias"`        → {@link AliasBinding}        (point a token at another token)
 *  - `"scale"`        → {@link ScaleBinding}        (base/spread sliders)
 *  - `"link"`         → {@link LinkBinding}         (follow another scale)
 *  - `"palette-swap"` → {@link PaletteSwapBinding}  (swap a whole palette family)
 */
export type PanelBinding = AliasBinding | ScaleBinding | LinkBinding | PaletteSwapBinding;

/**
 * Declares the project's color palette scale structure. All color-related
 * controls (palette-swap sections and color pickers) read from this.
 *
 * Separating this from the panel config means the palette scale is
 * declared once and consumed everywhere — no duplication, no inference
 * from token data.
 */
export type ColorScaleConfig = {
    /**
     * The palette groups available to the editing surface, as full token paths. They need
     * not share a parent, and they need not hold the same steps as each other — each
     * palette's steps are read from the tokens.
     *
     * @example
     * palettes: ["color.neutral", "color.pink", "brand.primary"]
     */
    palettes: string[];
    /**
     * Optional restriction on which steps the colour picker offers, and the order it shows
     * them in. Steps a palette doesn't have are simply absent from its ramp.
     *
     * @example
     * steps: ["100", "300", "500", "700", "900"]
     */
    steps?: string[];
};


/**
 * A section in the Studio editing panel. Groups bindings under a titled folder.
 * Each binding's control is determined by its discriminator (or inferred from
 * the token's `$type` for default `TokenBinding`s).
 */
export type BindingSection = {
    title: string;
    /** Default source for this section's alias bindings; each may override it. */
    from?: PanelSource;
    /** Default options for this section's alias bindings; each may override it. */
    options?: string | Record<string, string>;
    bindings: PanelBinding[];
};

/** A single section in the Studio editing panel. */
export type PanelSection = BindingSection;

/** Configuration for the Studio visual editing panel. */
export type StudioConfig = {
    /**
     * Declares the project's color palette scale structure. Consumed by
     * palette-swap sections (for the swap list) and color picker controls
     * (for the grid axes).
     */
    colorScale?: ColorScaleConfig;
    /** Declarative panel sections that define the editing surface. */
    panel?: PanelSection[];
};

/**
 * Configuration for sugarcube.
 * This is the shape of your config file (sugarcube.config.ts).
 *
 * @example
 * // sugarcube.config.ts
 * import { defineConfig } from "@sugarcube-sh/vite";
 *
 * export default defineConfig({
 *   resolver: "./tokens.resolver.json",
 *   variables: {
 *     path: "src/styles/tokens.css",
 *   },
 * });
 */
export interface SugarcubeConfig {
    /**
     * Path to the DTCG resolver document (.resolver.json).
     *
     * **Optional** - If omitted, sugarcube will automatically discover
     * `*.resolver.json` files in your project.
     *
     * Only specify this if you have multiple resolver files and need to
     * choose a specific one.
     */
    resolver?: string;

    /**
     * CSS variables output configuration.
     * Controls where variables are written, transforms, layers, and permutations.
     *
     * @example
     * variables: {
     *   path: "src/styles/tokens.css",
     *   layer: "tokens",
     *   transforms: { fluid: { min: 375, max: 1440 } },
     *   permutations: [
     *     { input: { theme: "light" }, selector: ":root" },
     *     { input: { theme: "dark" }, selector: "[data-theme=\"dark\"]" },
     *   ],
     * }
     */
    variables?: VariablesConfig;

    /**
     * Utility classes output configuration.
     * Controls where utilities are written, layers, and class definitions.
     *
     * @example
     * utilities: {
     *   path: "src/styles/utilities.css",
     *   layer: "utilities",
     *   classes: {
     *     "padding": { source: "space.*", directions: ["x", "y", "all"] },
     *   },
     * }
     */
    utilities?: UtilitiesOutputConfig;

    /**
     * Globs of source files scanned for token/utility usage.
     *
     * When omitted, scanning falls back to the working directory downward.
     *
     * @example content: ["./**\/*.{js,ts}", "../../lib/**\/*.heex"]
     */
    content?: string[];

    /**
     * Directory path where component files will be copied.
     * @example "src/components/ui"
     */
    components?: string;

    /**
     * Directory path where CUBE CSS files will be copied.
     * @example "src/styles"
     */
    cube?: string;

    /**
     * Studio visual editing configuration.
     * Defines the editing panel — which tokens appear in which sections
     * and which operations apply.
     */
    studio?: StudioConfig;
}

/**
 * Normalized configuration with all defaults applied.
 * Used internally after processing SugarcubeConfig.
 */
export interface InternalConfig {
    resolver?: string;

    /** CSS variables output configuration */
    variables: {
        path: string;
        prefix?: string;
        variableName?: VariableNameFn;
        layer?: string;
        transforms: {
            fluid: FluidConfig;
            colorFallbackStrategy: ColorFallbackStrategy;
        };
        permutations?: Permutation[];
        propagateDependents?: boolean;
    };

    /** Utility classes output configuration */
    utilities: {
        path: string;
        layer?: string;
        classes?: UtilityClassesConfig;
    };

    /** Globs scanned for token/utility usage (resolved to absolute at load) */
    content?: string[];

    /** Directory path where component files will be copied */
    components?: string;

    /** Directory path where CUBE CSS files will be copied */
    cube?: string;

    /** Studio visual editing configuration */
    studio?: StudioConfig;
}
