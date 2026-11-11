import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
    ConfigError,
    type LoadedConfig,
    type Reported,
    type UtilityCSS,
    configProblems,
    createChangeQueue,
    cssFrom,
    isConfigFile,
    loadInternalConfig,
    problemBlocks,
    tokensOnDisk,
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

interface SugarcubePluginOptions {
    /**
     * UnoCSS options passed directly to UnoCSS.
     * Use this to configure presets, theme, layers, outputToCssLayers, etc.
     * @see https://unocss.dev/config/
     */
    unoOptions?: UnoOptions;
}

export const SUGARCUBE_API_PLUGIN_NAME = "sugarcube:api";

/**
 * What other plugins, such as Studio's, can read from sugarcube's: the config in use, the problems
 * loading the config last found (the last good config stays in use meanwhile), the design tokens
 * as last read (their files' text with them), and a signal after every read. The tokens' own
 * problems are not here: a plugin editing them finds those from its own version.
 */
export interface SugarcubePluginContext {
    readonly config: LoadedConfig["config"];
    readonly configProblems: readonly Reported[];
    readonly tokens: DesignTokens;
    readonly onReload: (fn: () => void) => () => void;
}

interface Good {
    css: string;
    utilities: UtilityCSS;
}

const NO_UTILITIES: UtilityCSS = { rules: [], starts: [], safelist: [], customProperties: [] };

// Returns Promise<any> rather than Promise<Plugin[]> to avoid exposing Vite's
// Plugin type in the public API. Vite's Plugin type changes across major versions,
// and pnpm's strict isolation can resolve multiple physical copies of the same
// version, causing TypeScript to treat identical types as incompatible.
export default async function sugarcubePlugin(options: SugarcubePluginOptions = {}): Promise<any> {
    const { unoOptions = {} } = options;
    const timed = debugging(process.env.DEBUG);
    let root!: string;
    let loaded!: LoadedConfig;
    let tokens!: DesignTokens;
    const reading = dtcg(() => tokensOnDisk(loaded.config, root));
    let fromConfig: Reported[] = [];
    let tokenProblems: Reported[] = [];
    const getProblems = () => [...fromConfig, ...tokenProblems];
    let good: Good = { css: "", utilities: NO_UTILITIES };
    let logger: Logger | undefined;
    const listeners = new Set<() => void>();
    const logUnexpected = (error: unknown) =>
        logger?.error(`[sugarcube] ${error instanceof Error ? error.message : String(error)}`);

    const toTerminalBlocks = (problems: Reported[]) =>
        problemBlocks(problems, {
            cwd: root,
            entryFile: tokensOnDisk(loaded.config, root).entryFile,
            configFile: loaded.configFile,
            tokens,
        });

    const report = () => {
        for (const { severity, text } of toTerminalBlocks(getProblems())) {
            if (severity === "error") logger?.error(text);
            else logger?.warn(text);
        }
    };

    const makeCSSFrom = (next: DesignTokens): boolean => {
        tokens = next;
        const made = cssFrom(next, loaded.config);
        tokenProblems = made.diagnostics;
        if (hasErrors(getProblems())) return false;
        const utilities = made.utilities ?? NO_UTILITIES;
        const same = isDeepStrictEqual(
            [good.utilities.starts, good.utilities.safelist],
            [utilities.starts, utilities.safelist],
        );
        good = { css: made.variables.map((file) => file.css).join("\n"), utilities };
        return !same;
    };

    const reloadConfig = createChangeQueue<{ kind: "config" }>(["config"], {
        onChange: async () => {
            try {
                loaded = await loadInternalConfig({}, { root, lastConfigFile: loaded.configFile });
                fromConfig = [];
            } catch (error) {
                if (!(error instanceof ConfigError)) throw error;
                fromConfig = configProblems(error);
                report();
                return;
            }
            await reading.api.reread();
        },
        onError: logUnexpected,
    });

    const context: SugarcubePluginContext = {
        get config() {
            return loaded.config;
        },
        get configProblems() {
            return fromConfig;
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

    const applyRead = async (next: DesignTokens, read: ReadEvent) => {
        const started = performance.now();
        const utilitiesChanged = makeCSSFrom(next);
        const css = performance.now() - started;
        report();
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
        if (timed) {
            logger?.info(
                timing(read, { css, unocss: reloaded, rest: performance.now() - started }),
            );
        }
        for (const fn of listeners) fn();
    };
    let started: Promise<void> | undefined;
    const start = async (user: UserConfig) => {
        root = realpathSync(resolve(user.root ?? "."));
        loaded = await loadInternalConfig({}, { root });
        makeCSSFrom(await reading.api.getTokens());
        reading.api.onRead((next, read) => {
            applyRead(next, read).catch(logUnexpected);
        });
        await unocss?.ready;
        await unocss?.reloadConfig();
    };

    const plugins: Plugin[] = [
        reading,
        {
            name: "sugarcube",
            config: (user) => (started ??= start(user)),
            configResolved(config) {
                logger = config.logger;
                if (config.command === "serve") report();
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
                const text = toTerminalBlocks(problems)
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

function hasErrors(problems: Reported[]): boolean {
    return problems.some(({ severity }) => severity === "error");
}

function debugging(names = ""): boolean {
    return names.split(/[\s,]+/).some((name) => ["*", "sugarcube", "sugarcube:*"].includes(name));
}

interface Spent {
    css: number;
    unocss?: number;
    rest: number;
}

function timing({ file, ms }: ReadEvent, { css, unocss, rest }: Spent) {
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
export type { SugarcubeConfig, VariableNameFn } from "@sugarcube-sh/core";
