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
     * `"kebab"` splits each name in a token's path at its camelCase and PascalCase words, in
     * lowercase.
     * @example // case: "kebab" makes color.brandPrimary --color-brand-primary
     */
    case?: "kebab";

    /**
     * What joins the parts of a variable's name: the prefix, the names in the path, their words, and
     * a typography variable's CSS property.
     * @default "-"
     * @example // delimiter: "_" makes color.brandPrimary --color_brandPrimary
     */
    delimiter?: string;

    /**
     * Full control over the CSS variable name from a token path.
     * Overrides `prefix` and `case` when set, and `delimiter` but for joining a typography
     * variable's CSS property. Return the name without the leading `--`.
     */
    variableName?: VariableNameFn;

    /**
     * When set, output is wrapped in `@layer`.
     * @example "tokens"
     */
    layer?: string;

    transforms?: {
        /** Viewport range for tokens with the `sh.sugarcube.fluid` extension. */
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
     * Writes again, in each theme's block, every variable that refers to something the theme
     * changes, so a theme set on any element, not only on `<html>`, gives the right values. Turn
     * it off for the smallest CSS when a theme only ever sits on `<html>`.
     * @default true
     */
    redeclareDependents?: boolean;

    /**
     * @deprecated Renamed `redeclareDependents`. Still read, with a warning, until 1.0.
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

export type StudioConfig = {
    repository?: string;
    branch?: string;
    app?: string;
    save?: boolean;
    signIn?: string;
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
        case?: "kebab";
        delimiter?: string;
        variableName?: VariableNameFn;
        layer?: string;
        transforms: {
            fluid: FluidConfig;
            colorFallbackStrategy: ColorFallbackStrategy;
        };
        permutations?: Permutation[];
        redeclareDependents?: boolean;
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
