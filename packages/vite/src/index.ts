import {
    Instrumentation,
    PerfMonitor,
    assignCSSNames,
    clearMatchCache,
    convertConfigToUnoRules,
    generateCSSVariables,
    groupByContext,
    loadInternalConfig,
    loadTokens,
    resolveTokens,
} from "@sugarcube-sh/core";
import type {
    InternalConfig,
    NormalizedRenderableTokens,
    ResolvedTokens,
    SugarcubeConfig,
    TokenTree,
} from "@sugarcube-sh/core";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import UnoCSS from "@unocss/vite";
import { applyEdits, modify } from "jsonc-parser";
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

interface SugarcubePluginOptions {
    /**
     * UnoCSS options passed directly to UnoCSS.
     * Use this to configure presets, theme, layers, outputToCssLayers, etc.
     * @see https://unocss.dev/config/
     */
    unoOptions?: UnoOptions;
}

const perf = new PerfMonitor();

export interface SugarcubePluginContext {
    ready: Promise<void>;
    config: InternalConfig | null;
    tokens: NormalizedRenderableTokens | null;
    trees: TokenTree[] | null;
    resolved: ResolvedTokens | null;
    getCSS: () => string;
    writeTokenEdits: (
        sourcePath: string,
        edits: Array<{ jsonPath: string[]; value: unknown }>
    ) => Promise<void>;
    rerunPipeline: (modifiedResolved: ResolvedTokens) => Promise<void>;
    reloadConfig: () => Promise<void>;
    reloadTokens: () => Promise<void>;
    getRules: () => UnoRule[];
    getTokenDirs: () => string[];
    invalidate: (server: ViteDevServer) => void;
    onReload: (fn: () => void) => void;
    tasks: Promise<void>[];
    flushTasks: () => Promise<void>;
    setLogger: (logger: Logger) => void;
}

function createSugarcubeContext(): SugarcubePluginContext {
    let config: InternalConfig | null = null;
    let tokens: NormalizedRenderableTokens | null = null;
    let trees: TokenTree[] | null = null;
    let resolved: ResolvedTokens | null = null;
    let cachedCSS = "";
    let cachedRules: UnoRule[] = [];
    const reloadCallbacks: (() => void)[] = [];
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
        task.finally(() => {
            const index = tasks.indexOf(task);
            if (index > -1) tasks.splice(index, 1);
        });
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

    const generateCSS = async () => {
        if (!tokens || !config) {
            cachedCSS = "";
            return;
        }

        using I = new Instrumentation();
        I.start("Generate CSS Variables");
        const output = await generateCSSVariables(tokens, config);

        // Combine all CSS output files
        cachedCSS = output.map((file) => file.css).join("\n");

        I.end("Generate CSS Variables");
    };

    const updateAll = async () => {
        await generateCSS();
        cachedRules = buildRules();
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

        I.start("Process Tokens");
        tokens = assignCSSNames(
            groupByContext(trees, resolved),
            config,
            resolveResult.errors.validation
        );
        I.end("Process Tokens");
    };

    const initialize = async () => {
        using I = new Instrumentation();
        I.start("Initial total process");

        const { config: loadedConfig } = await loadInternalConfig();
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
        get tasks() {
            return tasks;
        },

        getRules() {
            return cachedRules;
        },

        async rerunPipeline(modifiedResolved: ResolvedTokens) {
            const localConfig = config;
            const localTrees = trees;
            if (!localConfig || !localTrees) return;
            const task = (async () => {
                tokens = assignCSSNames(groupByContext(localTrees, modifiedResolved), localConfig);
                await generateCSS();
                cachedRules = buildRules();
            })();
            return addTask(task);
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

        invalidate(server: ViteDevServer) {
            using I = new Instrumentation();
            I.start("Invalidate");

            const mapSize = server.moduleGraph.idToModuleMap.size;
            perf.log("SCANNING MODULE GRAPH for /__uno.css", { mapSize });

            for (const [id, module] of server.moduleGraph.idToModuleMap) {
                if (id === "/__uno.css") {
                    server.moduleGraph.invalidateModule(module);
                    server.reloadModule(module);
                    break;
                }
            }

            I.end("Invalidate");
        },

        onReload(fn: () => void) {
            reloadCallbacks.push(fn);
        },

        async writeTokenEdits(
            sourcePath: string,
            edits: Array<{ jsonPath: string[]; value: unknown }>
        ) {
            const fmt = { formattingOptions: { tabSize: 2, insertSpaces: true } };
            let raw = await readFile(sourcePath, "utf-8");

            for (const edit of edits) {
                const textEdits = modify(raw, edit.jsonPath, edit.value, fmt);
                raw = applyEdits(raw, textEdits);
            }

            await writeFile(sourcePath, raw, "utf-8");
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
    const absolute = resolve(process.cwd(), config.resolver);
    const lastSlash = absolute.lastIndexOf("/");
    const resolverDir = absolute.slice(0, lastSlash);

    return [resolverDir];
}

// Returns Promise<any> rather than Promise<Plugin[]> to avoid exposing Vite's
// Plugin type in the public API. Vite's Plugin type changes across major versions,
// and pnpm's strict isolation can resolve multiple physical copies of the same
// version, causing TypeScript to treat identical types as incompatible.
export default async function sugarcubePlugin(options: SugarcubePluginOptions = {}): Promise<any> {
    const { unoOptions = {} } = options;
    const ctx = createSugarcubeContext();
    // It's imperative to await the ready state otherwise
    // UnoCSS will not get the generated rules
    await ctx.ready;

    const sugarcubePreset: any = {
        name: "sugarcube",
        get rules() {
            return ctx.getRules();
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

    const plugins: Plugin[] = [
        {
            name: "sugarcube:config",
            configResolved(config) {
                ctx.setLogger(config.logger);
            },
        } satisfies Plugin,

        ...UnoCSS(unoConfig),
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

                        await ctx.reloadConfig();

                        // Force UnoCSS to reload its config
                        // Without this, UnoCSS will not get the new rules
                        const unocssPlugin = server.config.plugins.find(
                            (p) => p.name === "unocss:api"
                        );
                        if (unocssPlugin?.api) {
                            const unoContext = unocssPlugin.api.getContext();
                            await unoContext.reloadConfig();
                        }

                        // We use the same invalidation path as the token watcher as we know that approach works
                        ctx.invalidate(server);
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
                    "server start"
                );

                const tokenDirs = ctx.getTokenDirs();

                if (tokenDirs.length === 0) {
                    server.config.logger.warn(
                        "[sugarcube] Could not determine token directories from config"
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

                server.watcher.on("change", async (file) => {
                    // Check if it's a JSON file in one of our token directories
                    if (file.endsWith(".json") && tokenDirs.some((dir) => file.includes(dir))) {
                        server.config.logger.info(
                            "[sugarcube] Design tokens changed, reloading..."
                        );

                        using I = new Instrumentation();
                        I.start("Total File Change Handler");

                        perf.logModuleGraphStats(
                            server.moduleGraph.idToModuleMap.size,
                            server.moduleGraph.urlToModuleMap.size,
                            "before reload"
                        );

                        await ctx.reloadTokens();

                        // Invalidate UnoCSS module (contains both variables via preflight and utilities)
                        I.start("Vite Invalidate");
                        ctx.invalidate(server);
                        I.end("Vite Invalidate");

                        perf.logModuleGraphStats(
                            server.moduleGraph.idToModuleMap.size,
                            server.moduleGraph.urlToModuleMap.size,
                            "after invalidate"
                        );

                        I.end("Total File Change Handler");
                    }
                });
            },
        } satisfies Plugin,

        {
            name: "sugarcube:api",
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
