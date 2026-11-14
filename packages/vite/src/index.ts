import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
    ConfigError,
    type LoadedConfig,
    type AnyDiagnostic,
    type UtilityCSS,
    toConfigDiagnostics,
    createChangeQueue,
    generateCSS,
    isConfigFile,
    loadInternalConfig,
    formatProblemBlocks,
    getTokensOnDisk,
} from "@sugarcube-sh/core";
import type { DesignTokens } from "@sugarcube-sh/dtcg";
import { onFileChanged } from "@sugarcube-sh/dtcg/node";
import dtcg, { type ReadEvent } from "@sugarcube-sh/dtcg-vite";
import UnoCSS from "@unocss/vite";
import type { Logger, Plugin, UserConfig } from "vite";

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
    ready: Promise<unknown>;
    invalidate: () => void;
    reloadConfig: () => Promise<unknown>;
}

/**
 * Options for the sugarcube Vite plugin.
 */
interface SugarcubePluginOptions {
    /**
     * Options passed to UnoCSS, such as `{ presets: [presetWind4()] }`.
     *
     * @see {@link https://sugarcube.sh/docs/utilities/#extending-with-unocss-presets | Extending with UnoCSS presets}
     * @see {@link https://unocss.dev/config/ | UnoCSS config}
     */
    unoOptions?: UnoOptions;
}

/**
 * The name of the plugin that shares sugarcube's state.
 *
 * Other plugins find it by this name. Its `api` is a {@link SugarcubePluginContext}.
 */
export const SUGARCUBE_API_PLUGIN_NAME = "sugarcube:api";

/**
 * The state other plugins, such as studio's, can read from sugarcube.
 */
export interface SugarcubePluginContext {
    /** The config in use. After a config mistake, it's the last one that loaded. */
    readonly config: LoadedConfig["config"];
    /** The mistakes found the last time the config loaded. */
    readonly configProblems: readonly AnyDiagnostic[];
    /** The design tokens from the last read. Their problems are in `tokens.diagnostics`. */
    readonly tokens: DesignTokens;
    /** Calls `fn` after every read. Call what it returns to stop. */
    readonly onReload: (fn: () => void) => () => void;
}

interface LastGoodCSS {
    css: string;
    utilities: UtilityCSS;
}

const NO_UTILITIES: UtilityCSS = { rules: [], prefixes: [], safelist: [], customProperties: [] };

// Returns Promise<any> rather than Promise<Plugin[]> to avoid exposing Vite's
// Plugin type in the public API. Vite's Plugin type changes across major versions,
// and pnpm's strict isolation can resolve multiple physical copies of the same
// version, causing TypeScript to treat identical types as incompatible.
/**
 * Makes sugarcube's Vite plugins.
 *
 * They serve the CSS variables and utility classes as `virtual:sugarcube.css`.
 * They read the tokens again when a token file or the config changes.
 *
 * @param options - Options for the plugin, such as `{ unoOptions: { presets: [presetWind4()] } }`.
 *
 * @see {@link https://sugarcube.sh/docs/vite-plugin/ | Vite plugin}
 *
 * @example
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import sugarcube from "@sugarcube-sh/vite";
 *
 * export default defineConfig({ plugins: [sugarcube()] });
 */
export default async function sugarcubePlugin(options: SugarcubePluginOptions = {}): Promise<any> {
    const { unoOptions = {} } = options;
    const isDebugging = isDebugEnabled(process.env.DEBUG);
    let root!: string;
    let loaded!: LoadedConfig;
    let tokens!: DesignTokens;
    const dtcgPlugin = dtcg(() => getTokensOnDisk(loaded.config, root));
    let configProblems: AnyDiagnostic[] = [];
    let tokenProblems: AnyDiagnostic[] = [];
    const getProblems = () => [...configProblems, ...tokenProblems];
    let lastGood: LastGoodCSS = { css: "", utilities: NO_UTILITIES };
    let logger: Logger | undefined;
    const listeners = new Set<() => void>();
    const logUnexpected = (error: unknown) =>
        logger?.error(`[sugarcube] ${error instanceof Error ? error.message : String(error)}`);

    const formatBlocks = (problems: AnyDiagnostic[]) =>
        formatProblemBlocks(problems, {
            cwd: root,
            entryFile: getTokensOnDisk(loaded.config, root).entryFile,
            configFile: loaded.configFile,
            tokens,
        });

    const reportProblems = () => {
        for (const { severity, text } of formatBlocks(getProblems())) {
            if (severity === "error") logger?.error(text);
            else logger?.warn(text);
        }
    };

    const updateCSS = (next: DesignTokens): boolean => {
        tokens = next;
        const generated = generateCSS(next, loaded.config);
        tokenProblems = generated.diagnostics;
        if (hasErrors(getProblems())) return false;
        const utilities = generated.utilities ?? NO_UTILITIES;
        const sameUtilities = isDeepStrictEqual(
            [lastGood.utilities.prefixes, lastGood.utilities.safelist],
            [utilities.prefixes, utilities.safelist],
        );
        lastGood = { css: generated.variables.map((file) => file.css).join("\n"), utilities };
        return !sameUtilities;
    };

    const reloadConfig = createChangeQueue<{ kind: "config" }>(["config"], {
        onChange: async () => {
            try {
                loaded = await loadInternalConfig({}, { root, lastConfigFile: loaded.configFile });
                configProblems = [];
            } catch (error) {
                if (!(error instanceof ConfigError)) throw error;
                configProblems = toConfigDiagnostics(error);
                reportProblems();
                return;
            }
            await dtcgPlugin.api.reread();
        },
        onError: logUnexpected,
    });

    const context: SugarcubePluginContext = {
        get config() {
            return loaded.config;
        },
        get configProblems() {
            return configProblems;
        },
        get tokens() {
            return tokens;
        },
        onReload(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };

    const sugarcubePreset: any = {
        name: "sugarcube",
        get rules() {
            return lastGood.utilities.rules;
        },
        get safelist() {
            return lastGood.utilities.safelist;
        },
        preflights: [{ getCSS: () => lastGood.css }],
    };

    const unoPlugins: Plugin[] = UnoCSS({
        configFile: false,
        ...unoOptions,
        presets: [...(unoOptions.presets || []), sugarcubePreset],
    } as any);
    const unocss: UnoContext | undefined = unoPlugins
        .find((p) => p.name === "unocss:api")
        ?.api?.getContext();

    const handleRead = async (next: DesignTokens, read: ReadEvent) => {
        const started = performance.now();
        const utilitiesChanged = updateCSS(next);
        const css = performance.now() - started;
        reportProblems();
        let reloaded: number | undefined;
        if (!hasErrors(getProblems())) {
            if (utilitiesChanged) {
                const reloading = performance.now();
                await unocss?.reloadConfig();
                reloaded = performance.now() - reloading;
            } else {
                unocss?.invalidate();
            }
        }
        if (isDebugging) {
            logger?.info(
                formatTiming(read, { css, unocss: reloaded, rest: performance.now() - started }),
            );
        }
        for (const fn of listeners) fn();
    };
    let started: Promise<void> | undefined;
    const start = async (userConfig: UserConfig) => {
        root = realpathSync(resolve(userConfig.root ?? "."));
        loaded = await loadInternalConfig({}, { root });
        updateCSS(await dtcgPlugin.api.getTokens());
        dtcgPlugin.api.onRead((next, read) => {
            handleRead(next, read).catch(logUnexpected);
        });
        await unocss?.ready;
        await unocss?.reloadConfig();
    };

    const plugins: Plugin[] = [
        dtcgPlugin,
        {
            name: "sugarcube",
            config: (user) => (started ??= start(user)),
            configResolved(config) {
                logger = config.logger;
                if (config.command === "serve") reportProblems();
            },
            configureServer(dev) {
                if (loaded.configFile) dev.watcher.add(loaded.configFile);
                const onConfig = (file: string) => {
                    if (isConfigFile(file, root)) reloadConfig({ kind: "config" });
                };
                onFileChanged(dev.watcher, onConfig);
                dev.watcher.on("add", onConfig);
                dev.watcher.on("unlink", onConfig);
            },
        } satisfies Plugin,

        {
            name: "sugarcube:build",
            apply: "build",
            buildStart() {
                const problems = getProblems();
                if (problems.length === 0) return;
                const text = formatBlocks(problems)
                    .map((block) => block.text)
                    .join("\n\n");
                if (hasErrors(problems)) this.error(text);
                this.warn(text);
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

function hasErrors(problems: AnyDiagnostic[]): boolean {
    return problems.some(({ severity }) => severity === "error");
}

function isDebugEnabled(names = ""): boolean {
    return names.split(/[\s,]+/).some((name) => ["*", "sugarcube", "sugarcube:*"].includes(name));
}

interface StepTimes {
    css: number;
    unocss?: number;
    rest: number;
}

function formatTiming({ file, ms }: ReadEvent, { css, unocss, rest }: StepTimes) {
    const parts = [
        `read ${Math.round(ms)}ms`,
        `css ${Math.round(css)}ms`,
        ...(unocss === undefined ? [] : [`unocss ${Math.round(unocss)}ms`]),
        `total ${Math.round(ms + rest)}ms`,
        ...(file === undefined ? [] : [`(${file})`]),
    ];
    return `[sugarcube] ${parts.join("  ")}`;
}

export { defineConfig, kebabCase } from "@sugarcube-sh/core";
export type { SugarcubeConfig, VariableNameFunction } from "@sugarcube-sh/core";
