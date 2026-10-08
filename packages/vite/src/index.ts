import { basename, dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
    ConfigError,
    type InternalConfig,
    type LoadedConfig,
    type Reported,
    type UtilityCSS,
    type Where,
    configProblems,
    cssFrom,
    loadInternalConfig,
    problemsText,
    readOptions,
} from "@sugarcube-sh/core";
import type { Document } from "@sugarcube-sh/dtcg";
import dtcg, { type Read } from "@sugarcube-sh/dtcg-vite";
import UnoCSS from "@unocss/vite";
import { type Logger, type Plugin, type ViteDevServer, normalizePath } from "vite";

/** UnoCSS outputToCssLayers configuration */
type OutputToCssLayersOptions =
    | boolean
    | {
          cssLayerName?: (layer: string) => string | undefined;
      };

/**
 * UnoCSS configuration options.
 * @see https://unocss.dev/config/
 */
interface UnoOptions {
    /** Additional presets */
    presets?: unknown[];
    /** UnoCSS theme configuration */
    theme?: Record<string, unknown>;
    /** Layer ordering - maps layer names to numeric order */
    layers?: Record<string, number>;
    /** Output to CSS cascade layers (@layer) */
    outputToCssLayers?: OutputToCssLayersOptions;
    /** Any other UnoCSS options */
    [key: string]: unknown;
}

interface UnoContext {
    invalidate: () => void;
    reloadConfig: () => Promise<unknown>;
}

interface SugarcubePluginOptions {
    /**
     * UnoCSS options passed directly to UnoCSS.
     * Use this to configure presets, theme, layers, outputToCssLayers, etc.
     * @see https://unocss.dev/config/
     */
    unoOptions?: UnoOptions;
}

export const SUGARCUBE_API_PLUGIN_NAME = "sugarcube:api";

/** What other plugins, such as Studio's, can read from sugarcube's. */
export interface SugarcubePluginContext {
    config: InternalConfig;
    doc: Document;
    problems: Reported[];
    onReload: (fn: () => void) => () => void;
}

interface Good {
    css: string;
    utilities: UtilityCSS;
}

const NO_UTILITIES: UtilityCSS = { rules: [], starts: [], safelist: [] };

// Returns Promise<any> rather than Promise<Plugin[]> to avoid exposing Vite's
// Plugin type in the public API. Vite's Plugin type changes across major versions,
// and pnpm's strict isolation can resolve multiple physical copies of the same
// version, causing TypeScript to treat identical types as incompatible.
export default async function sugarcubePlugin(options: SugarcubePluginOptions = {}): Promise<any> {
    const { unoOptions = {} } = options;
    const timed = process.env.DEBUG === "true";
    let loaded = await loadInternalConfig();
    const tokens = dtcg(() => ({
        entry: loaded.config.resolver,
        read: readOptions(loaded.config),
    }));
    let doc = await tokens.api.document();
    let fromConfig: Reported[] = [];
    let tokenProblems: Reported[] = [];
    const problems = () => [...fromConfig, ...tokenProblems];
    let good: Good = { css: "", utilities: NO_UTILITIES };
    let logger: Logger | undefined;
    let server: ViteDevServer | undefined;
    const listeners = new Set<() => void>();

    const where = (cwd?: string): Where => ({
        cwd,
        folder: dirname(resolve(loaded.config.resolver)),
        labels: doc.permutations.map((permutation) => permutation.label),
        configFile: loaded.configFile,
    });

    const report = () => {
        const shown = problems();
        if (shown.length > 0) {
            const text = problemsText(shown, where(process.cwd()));
            if (failed(shown)) logger?.error(text);
            else logger?.warn(text);
        }
        if (failed(shown)) server?.ws.send(overlay(shown, where()));
    };

    const accept = (next: Document): boolean => {
        doc = next;
        const made = cssFrom(next, loaded.config);
        tokenProblems = made.diagnostics;
        if (failed(problems())) return false;
        const utilities = made.utilities ?? NO_UTILITIES;
        const same = isDeepStrictEqual(
            [good.utilities.starts, good.utilities.safelist],
            [utilities.starts, utilities.safelist],
        );
        good = { css: made.variables.map((file) => file.css).join("\n"), utilities };
        return !same;
    };

    accept(doc);

    const reloadConfig = async () => {
        try {
            loaded = await loadInternalConfig();
            fromConfig = [];
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            fromConfig = configProblems(error);
            report();
            return;
        }
        await tokens.api.reread();
    };

    const context: SugarcubePluginContext = {
        get config() {
            return loaded.config;
        },
        get doc() {
            return doc;
        },
        get problems() {
            return problems();
        },
        onReload(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };

    const sugarcubePreset: any = {
        name: "sugarcube",
        get rules() {
            return good.utilities.rules;
        },
        get safelist() {
            return good.utilities.safelist;
        },
        preflights: [{ getCSS: () => good.css }],
    };

    const unoPlugins: Plugin[] = UnoCSS({
        configFile: false,
        ...unoOptions,
        presets: [...(unoOptions.presets || []), sugarcubePreset],
    } as any);
    const unocss: UnoContext | undefined = unoPlugins
        .find((p) => p.name === "unocss:api")
        ?.api?.getContext();

    tokens.api.onRead(async (next, read) => {
        const started = performance.now();
        const utilitiesChanged = accept(next);
        const css = performance.now() - started;
        report();
        let reloaded: number | undefined;
        if (!failed(problems())) {
            if (utilitiesChanged) {
                const reloading = performance.now();
                await unocss?.reloadConfig();
                reloaded = performance.now() - reloading;
            }
            unocss?.invalidate();
        }
        if (timed) logger?.info(timing(read, css, reloaded, performance.now() - started));
        for (const fn of listeners) fn();
    });

    const plugins: Plugin[] = [
        tokens,
        {
            name: "sugarcube:report",
            configResolved(config) {
                logger = config.logger;
                if (config.command === "serve") report();
            },
            configureServer(dev) {
                server = dev;
                dev.ws.on("vite:client:connect", (_, client) => {
                    if (failed(problems())) client.send(overlay(problems(), where()));
                });
                dev.watcher.on("change", (file) => {
                    if (isConfigFile(file, loaded)) void reloadConfig();
                });
            },
        } satisfies Plugin,

        {
            name: "sugarcube:build",
            apply: "build",
            buildStart() {
                if (failed(problems())) {
                    this.error(problemsText(problems(), where(process.cwd())));
                }
            },
        } satisfies Plugin,

        ...unoPlugins,
        {
            name: "sugarcube:virtual-css",
            enforce: "pre",

            config() {
                return {
                    optimizeDeps: {
                        exclude: ["virtual:sugarcube.css"],
                    },
                };
            },

            async resolveId(id) {
                // Variables included via preflight, utilities via rules
                if (id === "virtual:sugarcube.css") {
                    // Resolve through UnoCSS's virtual module system
                    const resolved = await this.resolve("virtual:uno.css", undefined, {
                        skipSelf: true,
                    });
                    return resolved;
                }
            },
        } satisfies Plugin,

        {
            name: SUGARCUBE_API_PLUGIN_NAME,
            api: {
                getContext: () => context,
            },
        } satisfies Plugin,
    ];

    return plugins;
}

function failed(problems: Reported[]): boolean {
    return problems.some(({ severity }) => severity === "error");
}

function timing({ file, ms }: Read, css: number, unocss: number | undefined, after: number) {
    const parts = [
        `read ${Math.round(ms)}ms`,
        `css ${Math.round(css)}ms`,
        ...(unocss === undefined ? [] : [`unocss ${Math.round(unocss)}ms`]),
        `total ${Math.round(ms + after)}ms`,
        ...(file === undefined ? [] : [`(${basename(file)})`]),
    ];
    return `[sugarcube] ${parts.join("  ")}`;
}

function overlay(problems: Reported[], where: Where) {
    const errors = problems.filter(({ severity }) => severity === "error");
    const message = problemsText(errors, where, { colors: false });
    return { type: "error" as const, err: { message, stack: "", plugin: "sugarcube" } };
}

function isConfigFile(file: string, { configFile }: LoadedConfig): boolean {
    return configFile !== undefined && normalizePath(file) === normalizePath(configFile);
}

export { defineConfig, kebabCase } from "@sugarcube-sh/core";
export type { SugarcubeConfig, VariableNameFn } from "@sugarcube-sh/core";
