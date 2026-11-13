import type { UtilityClassConfig } from "./utilities.js";

/**
 * How colors outside sRGB are written.
 *
 * - `"native"` writes them as they are, such as `oklch(0.6 0.15 250)`.
 * - `"polyfill"` writes each color's `hex` first, then the color inside `@supports`. It is deprecated.
 *
 * @see {@link https://sugarcube.sh/docs/color-formats/#color-fallbacks | Color fallbacks}
 */
export type ColorFallbackStrategy = "native" | "polyfill";

/**
 * Names a token's CSS variable from its path.
 *
 * Return the name without the leading `--`.
 *
 * @example
 * // For the token color.primary
 * (path) => `ds-${path.replaceAll(".", "-")}`
 * // => --ds-color-primary
 */
export type VariableNameFunction = (path: string) => string;

/**
 * One resolver input, and where its variables are written.
 *
 * @see {@link https://sugarcube.sh/docs/theming/#custom-selectors-the-permutations-api | The permutations API}
 */
export type PermutationConfig = {
    /**
     * The context for each modifier, such as `{ mode: "dark" }`.
     *
     * A modifier left out uses its default context.
     */
    readonly input: Readonly<Record<string, string>>;
    /**
     * The selector the variables are written under, such as `'[data-mode="dark"]'`.
     *
     * An array is joined with commas.
     */
    readonly selector: string | readonly string[];
    /**
     * An at-rule to write the block inside, such as `"@media (prefers-color-scheme: dark)"`.
     */
    readonly atRule?: string;
    /**
     * A file to write this permutation to, such as `"src/styles/dark.css"`.
     *
     * @default `variables.path`
     */
    readonly path?: string;
};

/**
 * The viewport widths fluid tokens scale between, in pixels.
 *
 * @see {@link https://sugarcube.sh/docs/fluid-space-and-type/ | Fluid space and type}
 */
export type FluidViewport = {
    /**
     * The width where a fluid token is at its smallest.
     *
     * @default 320
     */
    readonly min: number;
    /**
     * The width where a fluid token is at its largest.
     *
     * @default 1200
     */
    readonly max: number;
};

/**
 * The utility classes to make, by CSS property.
 *
 * A property can have one entry or an array of them.
 */
export type UtilityClassesConfig = Readonly<
    Record<string, UtilityClassConfig | readonly UtilityClassConfig[]>
>;

/**
 * Settings for the CSS variables file.
 *
 * @see {@link https://sugarcube.sh/docs/reference/configuration-schema/#variables | variables}
 */
export interface VariablesConfig {
    /**
     * The file the variables are written to, such as `"src/styles/tokens.css"`.
     *
     * @default "src/styles/variables.gen.css", or "styles/variables.gen.css" with no `src` folder
     */
    path?: string;

    /**
     * Text added to the start of every variable's name.
     *
     * @example
     * // prefix: "ds", for the token color.primary
     * // => --ds-color-primary
     */
    prefix?: string;

    /**
     * Splits camelCase names into lowercase words.
     *
     * @example
     * // case: "kebab", for the token color.brandPrimary
     * // => --color-brand-primary
     */
    case?: "kebab";

    /**
     * The text between the parts of a variable's name.
     *
     * @default "-"
     *
     * @example
     * // delimiter: "_", for the token color.primary
     * // => --color_primary
     */
    delimiter?: string;

    /**
     * Names each variable yourself.
     *
     * When set, `prefix`, `case` and `delimiter` are not used.
     */
    variableName?: VariableNameFunction;

    /**
     * The cascade layer the variables are written in, such as `"tokens"`.
     *
     * @see {@link https://sugarcube.sh/docs/cascade-layers/ | Cascade layers}
     */
    layer?: string;

    /**
     * Settings for fluid tokens and for colors outside sRGB.
     */
    transforms?: {
        /**
         * The viewport widths fluid tokens scale between.
         *
         * @default { min: 320, max: 1200 }
         */
        fluid?: FluidViewport;
        /**
         * How colors outside sRGB are written.
         *
         * @default "native"
         */
        colorFallbackStrategy?: ColorFallbackStrategy;
    };

    /**
     * The resolver inputs to write, each under its own selector.
     *
     * When left out, the default input is written under `:root`.
     * Each other context of a modifier gets a `[data-modifier="context"]` block.
     *
     * @example
     * permutations: [
     *   { input: { mode: "light" }, selector: ":root" },
     *   { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
     * ]
     */
    permutations?: PermutationConfig[];

    /**
     * Writes a variable again where something it refers to changes.
     *
     * Then a selector such as `[data-mode="dark"]` works on any element, not only on `<html>`.
     * Turn it off for smaller CSS when the selector is only ever on `<html>`.
     *
     * @default true
     *
     * @see {@link https://sugarcube.sh/docs/theming/#theming-nested-elements | Nested elements}
     */
    redeclareDependents?: boolean;

    /**
     * @deprecated Use `redeclareDependents`. This name still works, with a warning, until 1.0.
     */
    propagateDependents?: boolean;
}

/**
 * Settings for the utility classes file.
 *
 * @see {@link https://sugarcube.sh/docs/utilities/ | Utilities}
 */
export interface UtilitiesConfig {
    /**
     * The file the utility classes are written to, such as `"src/styles/utilities.css"`.
     *
     * @default "src/styles/utilities.gen.css", or "styles/utilities.gen.css" with no `src` folder
     */
    path?: string;

    /**
     * The cascade layer the classes are written in, such as `"utilities"`.
     *
     * @see {@link https://sugarcube.sh/docs/cascade-layers/ | Cascade layers}
     */
    layer?: string;

    /**
     * The classes to make, by CSS property.
     *
     * @example
     * classes: {
     *   "background-color": { source: "color.*", prefix: "bg" },
     *   "padding": { source: "space.*", prefix: "p", directions: ["x", "y"] },
     * }
     * // => .bg-primary, .px-sm, .py-sm and the rest
     */
    classes?: UtilityClassesConfig;
}

/**
 * Settings for saving from studio to GitHub.
 */
export type StudioConfig = {
    /**
     * The GitHub repository the tokens are in, such as `"acme/site"`.
     */
    readonly repository?: string;
    /**
     * The branch studio saves to, such as `"main"`.
     *
     * @default the branch checked out
     */
    readonly branch?: string;
    /**
     * The GitHub App's name as it appears in its URL, such as `"acme-studio"`.
     *
     * Without it, studio can't offer to install the app.
     */
    readonly githubApp?: string;
    /**
     * Whether studio can save to GitHub.
     *
     * @default true
     */
    readonly save?: boolean;
    /**
     * The path of your site's sign-in function, such as `"/auth/studio"`.
     *
     * @default "/api/sugarcube-studio"
     */
    readonly signInPath?: string;
};

/**
 * The settings in `sugarcube.config.ts`.
 *
 * @see {@link https://sugarcube.sh/docs/reference/configuration-schema/ | Configuration}
 *
 * @example
 * export default defineConfig({
 *   resolver: "./tokens.resolver.json",
 *   variables: { path: "src/styles/tokens.css" },
 * });
 */
export interface SugarcubeConfig {
    /**
     * The resolver file to read, such as `"./tokens.resolver.json"`.
     *
     * When left out, sugarcube looks for one `*.resolver.json` in the project.
     */
    resolver?: string;

    /**
     * Settings for the CSS variables file.
     */
    variables?: VariablesConfig;

    /**
     * Settings for the utility classes file.
     */
    utilities?: UtilitiesConfig;

    /**
     * The files to scan for classes and variables, as globs.
     *
     * When left out, every file under the working folder is scanned.
     *
     * @example
     * content: ["./src/**\/*.{html,ts}", "../../lib/**\/*.heex"]
     */
    content?: string[];

    /**
     * The folder components are copied to, such as `"src/components/ui"`.
     *
     * @default "src/components/ui", or "components/ui" with no `src` folder
     */
    components?: string;

    /**
     * The folder CUBE CSS files are copied to, such as `"src/styles"`.
     *
     * @default "src/styles", or "styles" with no `src` folder
     */
    cube?: string;

    /**
     * Settings for saving from studio to GitHub.
     */
    studio?: StudioConfig;
}

/** The config with every default filled in. */
export interface InternalConfig {
    readonly resolver?: string;

    readonly variables: {
        readonly path: string;
        readonly prefix?: string;
        readonly case?: "kebab";
        readonly delimiter?: string;
        readonly variableName?: VariableNameFunction;
        readonly layer?: string;
        readonly transforms: {
            readonly fluid: FluidViewport;
            readonly colorFallbackStrategy: ColorFallbackStrategy;
        };
        readonly permutations?: readonly PermutationConfig[];
        readonly redeclareDependents?: boolean;
        readonly propagateDependents?: boolean;
    };

    readonly utilities: {
        readonly path: string;
        readonly layer?: string;
        readonly classes?: UtilityClassesConfig;
    };

    /** Resolved to absolute paths at load. */
    readonly content?: readonly string[];

    readonly components?: string;
    readonly cube?: string;
    readonly studio?: StudioConfig;
}
