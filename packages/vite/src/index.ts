import {
    Instrumentation,
    PerfMonitor,
    clearMatchCache,
    convertConfigToUnoRules,
    generateCSSVariables,
    loadAndResolveTokens,
    loadInternalConfig,
    processAndConvertTokens,
} from "@sugarcube-sh/core";
import type {
    InternalConfig,
    ModifierMeta,
    NormalizedConvertedTokens,
    SugarcubeConfig,
} from "@sugarcube-sh/core";

import UnoCSS from "@unocss/vite";
import type { Logger, Plugin, ViteDevServer } from "vite";

/** CSS object for UnoCSS rules - matches @unocss/core CSSObject */
type CSSObject = Record<string, string | number | undefined>;

/** UnoCSS dynamic rule: [pattern, handler] */
type UnoRule = [RegExp, (match: RegExpMatchArray) => CSSObject];

const perf = new PerfMonitor();

export interface SugarcubePluginContext {
    ready: Promise<void>;
    config: InternalConfig | null;
    tokens: NormalizedConvertedTokens | null;
    getCSS: () => string;
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
    let tokens: NormalizedConvertedTokens | null = null;
    let modifiers: ModifierMeta[] = [];
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
        const generatedRules = convertConfigToUnoRules(config.utilities ?? {}, tokens);
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
        const output = await generateCSSVariables(tokens, config, modifiers);

        // Combine all CSS output files
        cachedCSS = output.map((file) => file.css).join("\n");

        I.end("Generate CSS Variables");
    };

    const updateAll = async () => {
        await generateCSS();
        cachedRules = buildRules();
    };

    const loadTokens = async () => {
        if (!config) return;

        if (!config.resolver) {
            log.warn("[sugarcube] No resolver path specified in config. Skipping token loading.");
            return;
        }

        // Clear the match cache when tokens are reloaded
        clearMatchCache();

        using I = new Instrumentation();
        I.start("Load Tokens From Resolver");

        const tokenResult = await loadAndResolveTokens({
            type: "resolver",
            resolverPath: config.resolver,
            config: config,
        });

        I.end("Load Tokens From Resolver");

        // Store modifiers for CSS generation
        modifiers = tokenResult.modifiers ?? [];

        const allErrors = [
            ...tokenResult.errors.load,
            ...tokenResult.errors.flatten,
            ...tokenResult.errors.validation,
            ...tokenResult.errors.resolution,
        ];

        if (allErrors.length > 0) {
            const errorList = allErrors
                .map((error, index) => `  ${index + 1}. ${error.message}`)
                .join("\n");
            log.warn(`[sugarcube] Found ${allErrors.length} token error(s):\n${errorList}`);
        }

        I.start("Process Tokens");
        tokens = await processAndConvertTokens(
            tokenResult.trees,
            tokenResult.resolved,
            config,
            tokenResult.errors.validation
        );
        I.end("Process Tokens");
    };

    const initialize = async () => {
        using I = new Instrumentation();
        I.start("Initial total process");

        const { config: loadedConfig } = await loadInternalConfig();
        config = loadedConfig;
        await loadTokens();
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
        get tasks() {
            return tasks;
        },

        getRules() {
            return cachedRules;
        },

        async reloadConfig() {
            const task = (async () => {
                using I = new Instrumentation();
                I.start("Reload Config");

                const { config: loadedConfig } = await loadInternalConfig();
                config = loadedConfig;
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

                await loadTokens();
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

interface SugarcubePluginOptions<T = any> {
    unoPresets?: T[];
    unoTheme?: Record<string, any>;
}

/**
 * Extracts the token directory from the resolver path.
 * Assumes token files are in the same directory as the resolver document.
 * TODO: Support non-colocation of resolver and token files??
 */
function extractTokenDirs(config: InternalConfig): string[] {
    if (!config.resolver) {
        return [];
    }

    // Get directory containing the resolver document
    const lastSlash = config.resolver.lastIndexOf("/");
    const resolverDir = lastSlash === -1 ? "." : config.resolver.slice(0, lastSlash);

    return [resolverDir];
}

export default async function sugarcubePlugin(
    options: SugarcubePluginOptions = {}
): Promise<Plugin[]> {
    const { unoPresets = [], unoTheme } = options;
    const ctx = createSugarcubeContext();
    // It's imperative to await the ready state otherwise
    // UnoCSS will not get the generated rules
    await ctx.ready;

    const sugarcubePreset = {
        name: "sugarcube",
        get rules() {
            const rules = ctx.getRules();
            return rules;
        },
    };

    const plugins: Plugin[] = [
        {
            name: "sugarcube:config",
            configResolved(config) {
                ctx.setLogger(config.logger);
            },
        } satisfies Plugin,

        ...UnoCSS({
            presets: [...unoPresets, sugarcubePreset],
            theme: unoTheme,
        }),
        {
            name: "sugarcube:virtual-css",
            enforce: "pre",

            config() {
                return {
                    optimizeDeps: {
                        exclude: [
                            "virtual:sugarcube.css",
                            "virtual:sugarcube/variables.css",
                            "virtual:sugarcube/utilities.css",
                        ],
                    },
                };
            },

            resolveId(id) {
                if (id === "virtual:sugarcube/variables.css") {
                    return "/__sugarcube_variables.css";
                }
                if (id === "virtual:sugarcube/utilities.css") {
                    // Return the UnoCSS virtual module ID
                    return "/__uno.css";
                }
                if (id === "virtual:sugarcube.css") {
                    // Combined module imports both variables and utilities
                    return "/__sugarcube_combined.js";
                }
            },

            load(id) {
                // Strip query string for matching
                const cleanId = id.split("?")[0];

                if (cleanId === "/__sugarcube_variables.css") {
                    return {
                        code: ctx.getCSS(),
                        map: { mappings: "" },
                    };
                }

                if (cleanId === "/__sugarcube_combined.js") {
                    return {
                        code: `import "virtual:sugarcube/variables.css";\nimport "virtual:uno.css";`,
                        map: null,
                    };
                }
            },
        } satisfies Plugin,

        {
            name: "sugarcube:config-watcher",
            apply: "serve",
            configureServer(server: ViteDevServer) {
                perf.logWatcherSetup("sugarcube.config.ts/js", process.cwd());
                server.watcher.add(["sugarcube.config.ts", "sugarcube.config.js"]);

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
                            perf.log("FORCING UNOCSS RELOAD");
                            await unoContext.reloadConfig();
                            perf.log("UNO CSS RELOAD COMPLETE");
                        }

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

                // Watch all JSON files in the token directories
                for (const dir of tokenDirs) {
                    const pattern = `${dir}/**/*.json`;
                    perf.logWatcherSetup(pattern, dir);
                    server.watcher.add(pattern);
                }

                // Track all watcher events to see what, if anything, is causing load
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

                        // Invalidate the variables virtual module
                        const varMod = server.moduleGraph.getModuleById(
                            "/__sugarcube_variables.css"
                        );
                        if (varMod) {
                            server.moduleGraph.invalidateModule(varMod);
                            server.reloadModule(varMod);
                        }

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

export { defineConfig } from "@sugarcube-sh/core";
export type { SugarcubeConfig };
