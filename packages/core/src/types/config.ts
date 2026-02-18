import type { PropertyUtilityConfig } from "./utilities.js";

export type ColorFallbackStrategy = "native" | "polyfill";

export type FluidConfig = {
    min: number;
    max: number;
};

export type TransformsConfig = {
    fluid: FluidConfig;
    colorFallbackStrategy: ColorFallbackStrategy;
};

export type OutputConfig = {
    cssRoot: string;
    variables?: string;
    variablesFilename: string;
    utilities?: string;
    utilitiesFilename: string;
    cube?: string;
    components?: string;
    themeAttribute: string;
    defaultContext?: string;
};

export type UtilitiesConfig = Record<string, PropertyUtilityConfig | PropertyUtilityConfig[]>;

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
 *   output: { cssRoot: "src/styles" }
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
     * Output configuration.
     */
    output?: {
        /**
         * Base directory path where CSS files will be written.
         * This is the primary output location for generated styles.
         */
        cssRoot?: string;
        /**
         * Directory path where token variable CSS files will be written.
         * @default "{cssRoot}/global"
         */
        variables?: string;
        /**
         * Filename for the generated token variables CSS file.
         * @default "tokens.variables.gen.css"
         */
        variablesFilename?: string;
        /**
         * Directory path where utility class CSS files will be written.
         * @default "{cssRoot}/utilities"
         */
        utilities?: string;
        /**
         * Filename for the generated utilities CSS file.
         * @default "utilities.gen.css"
         */
        utilitiesFilename?: string;
        /**
         * Directory path where CUBE CSS files will be written.
         * @default "{cssRoot}"
         */
        cube?: string;
        /** Directory path where component files will be written. */
        components?: string;
        /**
         * HTML attribute used for theme selectors.
         * @default "data-theme"
         */
        themeAttribute?: string;
        /**
         * Which context should use the :root selector.
         * Other contexts will use [themeAttribute="contextName"] selectors.
         * @default The resolver's default context
         */
        defaultContext?: string;
    };

    /**
     * CSS utility class generation configuration.
     * Maps CSS property names to token sources and options.
     *
     * @example
     * utilities: {
     *   "background-color": { source: "color.background.*" },
     *   "padding": { source: "space.*", directions: ["x", "y", "all"] }
     * }
     */
    utilities?: UtilitiesConfig;
}

/**
 * Normalized configuration with all defaults applied.
 * Used internally after processing SugarcubeConfig.
 */
export interface InternalConfig {
    resolver?: string;
    transforms: TransformsConfig;
    output: OutputConfig;
    utilities?: UtilitiesConfig;
}
