import type { PropertyUtilityConfig } from "./utilities.js";

export type ColorFallbackStrategy = "native" | "polyfill";

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

// ---------------------------------------------------------------------------
// Studio panel config
// ---------------------------------------------------------------------------

/**
 * A single token binding in a panel section. Describes which token to show,
 * what control to render, and where to find available options.
 */
export type PanelBinding = {
    /** Token path or glob pattern (e.g. `"panel.radius"` or `"size.step.*"`). */
    token: string;
    /** Optional label override — default is derived from the token path. */
    label?: string;
    /** Override the inferred control type. `"scale"` treats matching tokens as a group. */
    type?: "scale";
    /**
     * Available options for a preset picker.
     * - `string` — glob pattern, discovers values from the token graph.
     * - `Record<string, string>` — explicit label-to-reference map.
     */
    options?: string | Record<string, string>;
    /** Link this token group to another group's scale transform. */
    scalesWith?: string;
    /**
     * For `type: "scale"` bindings: the path of the step that should be
     * treated as the scale's anchor — the step whose current value is
     * `1.0` multiplier relative to itself, and which the "base" slider
     * directly controls. Required for cascade-mode scale bindings.
     *
     * Not required for scale-extension-backed bindings (the extension
     * carries its own base).
     *
     * @example
     * { token: "size.step.*", type: "scale", base: "size.step.0" }
     */
    base?: string;
    /** Slider minimum (dimension / number tokens). */
    min?: number;
    /** Slider maximum (dimension / number tokens). */
    max?: number;
    /** Slider step increment (dimension / number tokens). */
    step?: number;
};

/**
 * A palette-swap section. Swaps which palette family a set of semantic tokens
 * references by replacing the palette name in each token's `$value` reference.
 *
 * Uses the top-level `studio.colorScale.palettes` list as the set of
 * available swap targets. An optional `palettes` override on the section
 * itself can narrow that list to a subset.
 *
 * @example
 * {
 *   title: "Base",
 *   type: "palette-swap",
 *   family: "color.neutral"
 * }
 */
export type PaletteSwapSection = {
    title: string;
    type: "palette-swap";
    /** Token path prefix whose children will have their palette reference swapped. */
    family: string;
    /**
     * Optional override of the palette list for this section only.
     * Defaults to the top-level `studio.colorScale.palettes`.
     */
    palettes?: string[];
};

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
     * The token path prefix where palette scales live. Combined with
     * palette name + step, forms a full token path.
     *
     * Pass `""` for projects whose palettes live at the token tree
     * root (e.g. `blue.50` with no `color.` parent).
     *
     * @example
     * prefix: "color"        // → color.blue.500, color.neutral.50
     * prefix: ""             // → blue.500, red.100
     * prefix: "brand.colors" // → brand.colors.primary.500
     */
    prefix: string;
    /**
     * Explicit list of palette names available in the editing surface.
     * These are the swappable options in palette-swap sections and the
     * columns in the color picker grid.
     *
     * @example
     * palettes: ["neutral", "slate", "blue", "red", "pink"]
     */
    palettes: string[];
    /**
     * Explicit list of scale step names. These are the rows in the
     * color picker grid. Combined with `prefix` and a palette name,
     * they form full token paths like `color.blue.500`.
     *
     * @example
     * steps: ["50", "100", "200", "300", "400", "500",
     *         "600", "700", "800", "900", "950"]
     */
    steps: string[];
    /**
     * Optional token path for a "pure white" escape hatch in the
     * color picker. When set, the color picker renders an extra
     * white swatch; picking it writes a reference to this token.
     *
     * @example
     * white: "color.white"
     */
    white?: string;
    /**
     * Optional token path for a "pure black" escape hatch in the
     * color picker. Same behavior as `white` but for black.
     *
     * @example
     * black: "color.black"
     */
    black?: string;
};

/**
 * A binding section. Groups one or more token bindings under a titled folder.
 * The control for each binding is inferred from the token's `$type` unless
 * overridden via `type` or `options`.
 */
export type BindingSection = {
    title: string;
    type?: never;
    bindings: PanelBinding[];
};

/** A single section in the Studio editing panel. */
export type PanelSection = PaletteSwapSection | BindingSection;

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
        layer?: string;
        transforms: {
            fluid: FluidConfig;
            colorFallbackStrategy: ColorFallbackStrategy;
        };
        permutations?: Permutation[];
    };

    /** Utility classes output configuration */
    utilities: {
        path: string;
        layer?: string;
        classes?: UtilityClassesConfig;
    };

    /** Directory path where component files will be copied */
    components?: string;

    /** Directory path where CUBE CSS files will be copied */
    cube?: string;

    /** Studio visual editing configuration */
    studio?: StudioConfig;
}
