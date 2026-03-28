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
     * Resolver input for this build — selects which modifier contexts to use.
     * Per the DTCG spec, each modifier not specified here uses its default.
     *
     * When set via CLI (`--input brand=ocean`), config permutations are ignored
     * and a single :root output is produced.
     *
     * @example
     * // Build for ocean brand
     * input: { brand: "ocean" }
     */
    input?: Record<string, string>;

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
}

/**
 * Normalized configuration with all defaults applied.
 * Used internally after processing SugarcubeConfig.
 */
export interface InternalConfig {
    resolver?: string;

    /** Resolver input for this build, e.g. { brand: "ocean" } */
    input?: Record<string, string>;

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
}
