import type { PropertyUtilityConfig } from "./utilities.js";

export type ColorFallbackStrategy = "native" | "polyfill";

/**
 * Maps a token's DTCG path to its CSS variable name (without the leading `--`).
 * Overrides `variables.prefix` entirely when set.
 *
 * @example
 * variableName: (path) => `ds-${path.replaceAll(".", "-").toLowerCase()}`
 */
export type VariableNameFn = (path: string) => string;

/**
 * A resolved token set and how to emit it as CSS.
 * Aligned with the DTCG resolver "permutation" concept - maps 1:1 to a resolver input.
 */
export type Permutation = {
    /**
     * Modifier name → context value. Missing modifiers use their DTCG defaults.
     * @example { theme: "dark" }
     */
    input: Record<string, string>;
    /**
     * Selector(s) wrapping this permutation's output. Arrays are comma-joined.
     * @example "[data-theme=\"dark\"]"
     * @example ["[data-color-mode=dark]", "[data-color-mode=auto]"]
     */
    selector: string | string[];
    /** e.g. `"@media (prefers-color-scheme: dark)"` */
    atRule?: string;
    /**
     * Write this permutation to its own file instead of the default variables path.
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

export interface VariablesConfig {
    /**
     * @example "src/styles/tokens.css"
     */
    path?: string;

    /**
     * Prepended to every generated CSS variable name.
     * @example // prefix: "ds" → color.brandPrimary becomes --ds-color-brandPrimary
     */
    prefix?: string;

    /**
     * Full control over the CSS variable name from a token path.
     * Overrides `prefix` when set. Return the name without the leading `--`.
     */
    variableName?: VariableNameFn;

    /**
     * When set, output is wrapped in `@layer`.
     * @example "tokens"
     */
    layer?: string;

    transforms?: {
        /** Viewport range for `$type: "fluidDimension"` tokens. */
        fluid?: FluidConfig;
        /**
         * Colors outside sRGB:
         * - `"native"` — CSS color functions as-is
         * - `"polyfill"` — generate fallbacks for older browsers
         */
        colorFallbackStrategy?: ColorFallbackStrategy;
    };

    /**
     * How modifier contexts map to CSS selectors.
     * When omitted, sugarcube resolves with all defaults and outputs to `:root`.
     *
     * @example
     * permutations: [
     *   { input: { theme: "light" }, selector: ":root" },
     *   { input: { theme: "dark" }, selector: "[data-theme=\"dark\"]" },
     * ]
     */
    permutations?: Permutation[];

    /**
     * Re-emit dependent variables on modifier selectors.
     * @default false
     */
    propagateDependents?: boolean;
}

export interface UtilitiesOutputConfig {
    /**
     * @example "src/styles/utilities.css"
     */
    path?: string;

    /**
     * When set, output is wrapped in `@layer`.
     * @example "utilities"
     */
    layer?: string;

    /**
     * Maps CSS properties to token sources and generation options.
     *
     * @example
     * classes: {
     *   "background-color": { source: "color.background.*" },
     *   "padding": { source: "space.*", directions: ["x", "y", "all"] },
     * }
     */
    classes?: UtilityClassesConfig;
}

/**
 * A named source of choices declared elsewhere in `studio` config.
 * Today only `"colorScale"`; the control a row renders follows from the source.
 */
export type PanelSource = "colorScale";

/**
 * Points a token at one of a constrained set of other tokens
 * (colours, radii, border widths, fonts, …).
 *
 * Exactly one of `from` / `options` must resolve (on the binding or inherited
 * from its section). Supplying neither, or both, fails at config load.
 *
 * @example
 * { type: "alias", token: "panel.radius", label: "Panels" }          // inherits from section
 * { type: "alias", token: "color.surface.*", from: "colorScale" }
 */
export type AliasBinding = {
    type: "alias";
    /** Token path or glob (e.g. `"panel.radius"`, `"color.surface.*"`). */
    token: string;
    /**
     * Named source in `studio` config. Mutually exclusive with `options`.
     */
    from?: PanelSource;
    /**
     * Explicit choices (a glob, or a label → reference map).
     * Mutually exclusive with `from`.
     */
    options?: string | Record<string, string>;
    /** Defaults to the token's last segment. */
    label?: string;
    /** Per-match labels for a glob binding, keyed by last segment. */
    labels?: Record<string, string>;
    /**
     * Last segments to render, in this order. Filters and orders;
     * without it, matches render in token order.
     */
    only?: string[];
};

/**
 * Panel control for a group of fluid tokens.
 *
 * Dispatch depends on whether a `sh.sugarcube.scale` recipe exists at the bound path:
 * - Recipe present → recipe-aware UI (`mode` chooses exponential vs multipliers)
 * - No recipe → bulk controls (base + spread) plus per-step inputs
 *
 * @example
 * { type: "scale", token: "size.step.*", base: "size.step.0" }
 */
export type ScaleBinding = {
    type: "scale";
    token: string;
    label?: string;
    /**
     * Step that anchors the bulk slider. Its max-viewport value is controlled
     * directly; other steps adjust proportionally.
     */
    base?: string;
    min?: number;
    max?: number;
    step?: number;
};

/**
 * A family of tokens that follows another scale's transform.
 * Value is a boolean; the editor is a switch.
 *
 * @example
 * { type: "link", token: "container.*", scalesWith: "size.step.*" }
 */
export type LinkBinding = {
    type: "link";
    token: string;
    /** Scale whose transform is mirrored. */
    scalesWith: string;
    label?: string;
};

/**
 * Swaps which palette family a set of semantic tokens references, by rewriting
 * the palette name in each token's `$value`. Uses `studio.colorScale.palettes`
 * unless `palettes` narrows the list.
 *
 * @example
 * { type: "palette-swap", family: "color.neutral", label: "Base" }
 */
export type PaletteSwapBinding = {
    type: "palette-swap";
    /** Path prefix whose children get their palette reference swapped. */
    family: string;
    label?: string;
    /** Defaults to `studio.colorScale.palettes`. */
    palettes?: string[];
};

export type PanelBinding = AliasBinding | ScaleBinding | LinkBinding | PaletteSwapBinding;

/**
 * Project colour palette scale. Declared once; consumed by palette-swap and colour pickers.
 */
export type ColorScaleConfig = {
    /**
     * Palette groups available to the editing surface, as full token paths.
     * Need not share a parent or the same steps — each palette's steps come from the tokens.
     * @example ["color.neutral", "color.pink", "brand.primary"]
     */
    palettes: string[];
    /**
     * Restricts which steps the colour picker offers, and their order.
     * Steps a palette doesn't have are simply absent.
     * @example ["100", "300", "500", "700", "900"]
     */
    steps?: string[];
};

/** A titled folder of bindings in the Studio editing panel. */
export type BindingSection = {
    title: string;
    /** Default `from` for alias bindings in this section. */
    from?: PanelSource;
    /** Default `options` for alias bindings in this section. */
    options?: string | Record<string, string>;
    bindings: PanelBinding[];
};

export type PanelSection = BindingSection;

export type StudioConfig = {
    colorScale?: ColorScaleConfig;
    panel?: PanelSection[];
};

/**
 * Shape of `sugarcube.config.ts`.
 *
 * @example
 * export default defineConfig({
 *   resolver: "./tokens.resolver.json",
 *   variables: { path: "src/styles/tokens.css" },
 * });
 */
export interface SugarcubeConfig {
    /**
     * Path to the DTCG resolver document.
     * When omitted, sugarcube discovers `*.resolver.json` in the project.
     * Only needed when multiple resolvers exist and you must pick one.
     */
    resolver?: string;

    variables?: VariablesConfig;

    utilities?: UtilitiesOutputConfig;

    /**
     * Globs scanned for token/utility usage.
     * When omitted, scanning falls back to the working directory downward.
     * @example ["./**\/*.{js,ts}", "../../lib/**\/*.heex"]
     */
    content?: string[];

    /**
     * @example "src/components/ui"
     */
    components?: string;

    /**
     * Where CUBE CSS files are copied.
     * @example "src/styles"
     */
    cube?: string;

    studio?: StudioConfig;
}

/** Normalized config with defaults applied. Used internally after processing {@link SugarcubeConfig}. */
export interface InternalConfig {
    resolver?: string;

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

    utilities: {
        path: string;
        layer?: string;
        classes?: UtilityClassesConfig;
    };

    /** Resolved to absolute paths at load. */
    content?: string[];

    components?: string;
    cube?: string;
    studio?: StudioConfig;
}
