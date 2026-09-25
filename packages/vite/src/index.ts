import {
    Instrumentation,
    PerfMonitor,
    assignCSSNames,
    clearMatchCache,
    convertConfigToUnoRules,
    createCoalescedRunner,
    debounce,
    enumerateSafelistClasses,
    generateCSSVariables,
    groupByContext,
    loadInternalConfig,
    loadTokens,
    resolveTokens,
} from "@sugarcube-sh/core";
import type {
    InternalConfig,
    NormalizedRenderableTokens,
    Permutation,
    ResolvedTokens,
    TokenSources,
    TokenTree,
} from "@sugarcube-sh/core";

import { dirname, resolve } from "node:path";
import UnoCSS from "@unocss/vite";
import type { Logger, Plugin, ViteDevServer } from "vite";

/** CSS object for UnoCSS rules - matches @unocss/core CSSObject */
type CSSObject = Record<string, string | number | undefined>;

/** UnoCSS dynamic rule: [pattern, handler] */
type UnoRule = [RegExp, (match: RegExpMatchArray) => CSSObject];

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

const perf = new PerfMonitor();

export const SUGARCUBE_API_PLUGIN_NAME = "sugarcube:api";

export interface SugarcubePluginContext {
    ready: Promise<void>;
    config: InternalConfig | null;
    tokens: NormalizedRenderableTokens | null;
    trees: TokenTree[] | null;
    resolved: ResolvedTokens | null;
    defaultContext: string | null;
    permutations: Permutation[];
    sources: TokenSources | null;
    errors: readonly string[];
    getCSS: () => string;
    reloadConfig: () => Promise<void>;
    reloadTokens: () => Promise<void>;
    getRules: () => UnoRule[];
    getSafelist: () => string[];
    getTokenDirs: () => string[];
    onReload: (fn: () => void) => () => void;
    tasks: Promise<void>[];
    flushTasks: () => Promise<void>;
    setLogger: (logger: Logger) => void;
}

function createSugarcubeContext(unocss: () => UnoContext | undefined): SugarcubePluginContext {
    let config: InternalConfig | null = null;
    let tokens: NormalizedRenderableTokens | null = null;
    let trees: TokenTree[] | null = null;
    let resolved: ResolvedTokens | null = null;
    let sources: TokenSources | null = null;
    let permutations: Permutation[] = [];
    let defaultContext: string | null = null;
    let errors: readonly string[] = [];
    let cachedCSS = "";
    let cachedRules: UnoRule[] = [];
    let cachedSafelist: string[] = [];
    const reloadCallbacks = new Set<() => void>();
    const tasks: Promise<void>[] = [];
    let logger: Logger | null = null;
    const pendingLogs: Array<{ level: "info" | "warn"; msg: string }> = [];

    const log = {
        warn: (msg: string) => {
            if (logger) logger.warn(msg);
            else pendingLogs.push({ level: "warn", msg });
        },
        info: (msg: string) => {
            if (logger) logger.info(msg);
            else pendingLogs.push({ level: "info", msg });
        },
    };

    const addTask = (task: Promise<void>) => {
        tasks.push(task);
        const remove = () => {
            const index = tasks.indexOf(task);
            if (index > -1) tasks.splice(index, 1);
        };
        task.then(remove, remove);
        return task;
    };

    const buildRules = () => {
        if (!tokens || !config) {
            return [];
        }

        using I = new Instrumentation();
        I.start("Build Rules");
        const generatedRules = convertConfigToUnoRules(config.utilities.classes ?? {}, tokens);
        I.end("Build Rules");

        return generatedRules;
    };

    const buildSafelist = () => {
        if (!tokens || !config) {
            return [];
        }
        return enumerateSafelistClasses(config.utilities.classes ?? {}, tokens);
    };

    const generateCSS = async () => {
        if (!tokens || !config) {
            cachedCSS = "";
            return;
        }

        using I = new Instrumentation();
        I.start("Generate CSS Variables");
        const output = await generateCSSVariables(tokens, config, permutations);

        // Combine all CSS output files
        cachedCSS = output.map((file) => file.css).join("\n");

        I.end("Generate CSS Variables");
    };

    const updateAll = async () => {
        await generateCSS();
        cachedRules = buildRules();
        cachedSafelist = buildSafelist();
    };

    const runPipeline = async () => {
        if (!config) return;

        if (!config.resolver) {
            log.warn("[sugarcube] No resolver path specified in config. Skipping token loading.");
            return;
        }

        // Clear the match cache when tokens are reloaded
        clearMatchCache();

        using I = new Instrumentation();
        I.start("Load Tokens From Resolver");

        const loaded = await loadTokens({
            type: "resolver",
            resolverPath: config.resolver,
            config: config,
        });

        const resolveResult = resolveTokens(loaded.trees);

        I.end("Load Tokens From Resolver");

        const allErrors = [
            ...loaded.errors,
            ...resolveResult.errors.expandTree,
            ...resolveResult.errors.flatten,
            ...resolveResult.errors.validation,
            ...resolveResult.errors.resolution,
        ];

        if (allErrors.length > 0) {
            const errorList = allErrors
                .map((error, index) => `  ${index + 1}. ${error.message}`)
                .join("\n");
            log.warn(`[sugarcube] Found ${allErrors.length} token error(s):\n${errorList}`);
        }

        if (resolveResult.warnings.length > 0) {
            for (const warning of resolveResult.warnings) {
                log.warn(`[sugarcube] ${warning.message}`);
            }
        }

        trees = resolveResult.trees;
        resolved = resolveResult.resolved;
        sources = loaded.sources ?? null;
        permutations = loaded.permutations;
        defaultContext = loaded.defaultContext ?? null;
        errors = allErrors.map((error) => error.message);

        I.start("Process Tokens");
        tokens = assignCSSNames(
            groupByContext(trees, resolved),
            config,
            resolveResult.errors.validation,
        );
        I.end("Process Tokens");
    };

    const initialize = async () => {
        using I = new Instrumentation();
        I.start("Initial total process");

        I.start("Load Config");
        const { config: loadedConfig } = await loadInternalConfig();
        I.end("Load Config");
        config = loadedConfig;
        await runPipeline();
        await updateAll();

        I.end("Initial total process");
    };

    const ctx = {
        ready: addTask(initialize()),

        get config() {
            return config;
        },
        get tokens() {
            return tokens;
        },
        get trees() {
            return trees;
        },
        get resolved() {
            return resolved;
        },
        get defaultContext() {
            return defaultContext;
        },
        get permutations() {
            return permutations;
        },
        get sources() {
            return sources;
        },
        get errors() {
            return errors;
        },
        get tasks() {
            return tasks;
        },

        getRules() {
            return cachedRules;
        },

        getSafelist() {
            return cachedSafelist;
        },

        async reloadConfig() {
            const task = (async () => {
                using I = new Instrumentation();
                I.start("Reload Config");

                const { config: loadedConfig } = await loadInternalConfig();
                config = loadedConfig;

                // Permutation changes affect token resolution, so we need to re-run
                // the full token pipeline, not just CSS regeneration
                await runPipeline();
                await updateAll();
                // Without this, UnoCSS will not get the new rules
                await unocss()?.reloadConfig();
                unocss()?.invalidate();

                for (const fn of reloadCallbacks) fn();
                I.end("Reload Config");
            })();

            return addTask(task);
        },

        async reloadTokens() {
            const task = (async () => {
                using I = new Instrumentation();
                I.start("Reload total process");

                await runPipeline();
                await updateAll();
                unocss()?.invalidate();

                for (const fn of reloadCallbacks) fn();
                I.end("Reload total process");
            })();

            return addTask(task);
        },

        getCSS() {
            return cachedCSS;
        },

        getTokenDirs(): string[] {
            if (!config) return [];
            return extractTokenDirs(config);
        },

        onReload(fn: () => void) {
            reloadCallbacks.add(fn);
            return () => {
                reloadCallbacks.delete(fn);
            };
        },

        async flushTasks() {
            await Promise.all(tasks);
        },

        setLogger(l: Logger) {
            logger = l;
            for (const { level, msg } of pendingLogs) {
                logger[level](msg);
            }
            pendingLogs.length = 0;
        },
    };

    return ctx;
}

/**
 * Extracts the token directory from the resolver path.
 * Assumes token files are in the same directory as the resolver document.
 * TODO: Support non-colocation of resolver and token files??
 */
export function extractTokenDirs(config: Pick<InternalConfig, "resolver">): string[] {
    if (!config.resolver) {
        return [];
    }

    // Resolve to absolute path so it matches Vite's absolute watcher paths
    // Without this working properly, the token watcher will not work correctly
    return [dirname(resolve(process.cwd(), config.resolver))];
}

// Returns Promise<any> rather than Promise<Plugin[]> to avoid exposing Vite's
// Plugin type in the public API. Vite's Plugin type changes across major versions,
// and pnpm's strict isolation can resolve multiple physical copies of the same
// version, causing TypeScript to treat identical types as incompatible.
export default async function sugarcubePlugin(options: SugarcubePluginOptions = {}): Promise<any> {
    const { unoOptions = {} } = options;
    let unocss: UnoContext | undefined;
    const ctx = createSugarcubeContext(() => unocss);
    // It's imperative to await the ready state otherwise
    // UnoCSS will not get the generated rules
    await ctx.ready;

    const sugarcubePreset: any = {
        name: "sugarcube",
        get rules() {
            return ctx.getRules();
        },
        get safelist() {
            return ctx.getSafelist();
        },
        // Variables are always included via preflight now
        preflights: [
            {
                getCSS: () => ctx.getCSS(),
            },
        ],
    };

    const unoConfig: any = {
        configFile: false,
        ...unoOptions,
        presets: [...(unoOptions.presets || []), sugarcubePreset],
    };

    const unoPlugins: Plugin[] = UnoCSS(unoConfig);
    unocss = unoPlugins.find((p) => p.name === "unocss:api")?.api?.getContext();

    const plugins: Plugin[] = [
        {
            name: "sugarcube:config",
            configResolved(config) {
                ctx.setLogger(config.logger);
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
            name: "sugarcube:config-watcher",
            apply: "serve",
            configureServer(server: ViteDevServer) {
                // Vite already watches the project root, so we just listen for changes
                // to our config files without needing to call server.watcher.add()
                server.watcher.on("change", async (file) => {
                    if (
                        file.endsWith("sugarcube.config.ts") ||
                        file.endsWith("sugarcube.config.js")
                    ) {
                        server.config.logger.info("[sugarcube] Config changed, reloading...");
                        perf.log("CONFIG CHANGE DETECTED", {
                            file: file.split("/").slice(-2).join("/"),
                        });

                        try {
                            await ctx.reloadConfig();
                        } catch (error) {
                            server.config.logger.error(
                                `[sugarcube] Config reload failed: ${
                                    error instanceof Error ? error.message : String(error)
                                }`,
                            );
                        }
                    }
                });
            },
        } satisfies Plugin,

        {
            name: "sugarcube:token-watcher",
            apply: "serve",
            async configureServer(server: ViteDevServer) {
                server.watcher.setMaxListeners(30);

                // Start memory monitoring when dev server starts
                perf.startMemoryMonitor();
                perf.logModuleGraphStats(
                    server.moduleGraph.idToModuleMap.size,
                    server.moduleGraph.urlToModuleMap.size,
                    "server start",
                );

                const tokenDirs = ctx.getTokenDirs();

                if (tokenDirs.length === 0) {
                    server.config.logger.warn(
                        "[sugarcube] Could not determine token directories from config",
                    );
                    return;
                }

                // Vite already watches the project root by default, so we don't need
                // to call server.watcher.add(). We just listen for change events and
                // filter for our token directories.

                // Track all watcher events for performance monitoring
                server.watcher.on("all", (event, file) => {
                    perf.trackWatcherEvent(file, server.moduleGraph.idToModuleMap.size);
                });

                // A single reload cycle: reload tokens, then invalidate the UnoCSS
                // module (which holds both variables via preflight and utilities).
                const runReload = createCoalescedRunner(
                    async () => {
                        server.config.logger.info(
                            "[sugarcube] Design tokens changed, reloading...",
                        );
                        using I = new Instrumentation();
                        I.start("Total File Change Handler");
                        await ctx.reloadTokens();
                        I.end("Total File Change Handler");
                    },
                    (error) => {
                        server.config.logger.error(
                            `[sugarcube] Token reload failed: ${
                                error instanceof Error ? error.message : String(error)
                            }`,
                        );
                    },
                );

                const scheduleReload = debounce(runReload, 100);

                server.watcher.on("change", (file) => {
                    if (file.endsWith(".json") && tokenDirs.some((dir) => file.includes(dir))) {
                        scheduleReload();
                    }
                });

                // Drop any pending reload when the dev server shuts down so a
                // stray timer can't fire against a torn-down server.
                server.httpServer?.once("close", () => scheduleReload.cancel());
            },
        } satisfies Plugin,

        {
            name: SUGARCUBE_API_PLUGIN_NAME,
            api: {
                getContext: () => ctx,
            },
        } satisfies Plugin,

        {
            name: "sugarcube:build",
            apply: "build",
            enforce: "pre",
            async configResolved() {
                await ctx.ready;
            },
            async buildStart() {
                await ctx.flushTasks();
            },
        } satisfies Plugin,
    ];

    return plugins;
}

export { defineConfig, kebabCase } from "@sugarcube-sh/core";
export type { SugarcubeConfig, VariableNameFn } from "@sugarcube-sh/core";
