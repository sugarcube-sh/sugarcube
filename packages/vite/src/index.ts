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
import type { FSWatcher, Logger, Plugin, UserConfig } from "vite";

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

const VIRTUAL_CSS_ID = "virtual:sugarcube.css";

const NO_UTILITIES: UtilityCSS = { rules: [], prefixes: [], safelist: [], customProperties: [] };

class PluginState {
    readonly dtcgPlugin: ReturnType<typeof dtcg>;
    readonly unoPlugins: Plugin[];
    readonly context: SugarcubePluginContext;
    #unocss: UnoContext | undefined;
    #isDebugging = isDebugEnabled(process.env.DEBUG);
    #root!: string;
    #loaded!: LoadedConfig;
    #tokens!: DesignTokens;
    #configProblems: AnyDiagnostic[] = [];
    #tokenProblems: AnyDiagnostic[] = [];
    #lastGoodCSS: LastGoodCSS = { css: "", utilities: NO_UTILITIES };
    #logger: Logger | undefined;
    #listeners = new Set<() => void>();
    #started: Promise<void> | undefined;
    #configChanges = createChangeQueue<{ kind: "config" }>(["config"], {
        onChange: () => this.#reloadConfig(),
        onError: (error) => this.#logUnexpectedError(error),
    });

    constructor(unoOptions: UnoOptions) {
        this.dtcgPlugin = dtcg(() => getTokensOnDisk(this.#loaded.config, this.#root));
        this.unoPlugins = UnoCSS({
            configFile: false,
            ...unoOptions,
            presets: [...(unoOptions.presets || []), this.#createPreset()],
        } as any);
        this.#unocss = this.unoPlugins.find((p) => p.name === "unocss:api")?.api?.getContext();
        this.context = this.#createContext();
    }

    start(userConfig: UserConfig): Promise<void> {
        this.#started ??= this.#load(userConfig);
        return this.#started;
    }

    async #load(userConfig: UserConfig): Promise<void> {
        this.#root = realpathSync(resolve(userConfig.root ?? "."));
        this.#loaded = await loadInternalConfig({}, { root: this.#root });
        this.#updateCSS(await this.dtcgPlugin.api.getTokens());
        this.dtcgPlugin.api.onRead((next, read) => {
            this.#handleRead(next, read).catch((error) => this.#logUnexpectedError(error));
        });
        await this.#unocss?.ready;
        await this.#unocss?.reloadConfig();
    }

    useLogger(logger: Logger, isServing: boolean): void {
        this.#logger = logger;
        if (isServing) this.#reportProblems();
    }

    watchConfig(watcher: FSWatcher): void {
        if (this.#loaded.configFile) watcher.add(this.#loaded.configFile);
        const onConfig = (file: string) => {
            if (isConfigFile(file, this.#root)) this.#configChanges({ kind: "config" });
        };
        onFileChanged(watcher, onConfig);
        watcher.on("add", onConfig);
        watcher.on("unlink", onConfig);
    }

    formatBuildProblems(): { text: string; hasErrors: boolean } | undefined {
        const problems = this.#getProblems();
        if (problems.length === 0) return undefined;
        const text = this.#formatBlocks(problems)
            .map((block) => block.text)
            .join("\n\n");
        return { text, hasErrors: hasErrors(problems) };
    }

    #createPreset(): unknown {
        const lastGoodCSS = () => this.#lastGoodCSS;
        return {
            name: "sugarcube",
            get rules() {
                return lastGoodCSS().utilities.rules;
            },
            get safelist() {
                return lastGoodCSS().utilities.safelist;
            },
            preflights: [{ getCSS: () => lastGoodCSS().css }],
        };
    }

    #createContext(): SugarcubePluginContext {
        const read = {
            config: () => this.#loaded.config,
            configProblems: () => this.#configProblems,
            tokens: () => this.#tokens,
        };
        return {
            get config() {
                return read.config();
            },
            get configProblems() {
                return read.configProblems();
            },
            get tokens() {
                return read.tokens();
            },
            onReload: (fn) => {
                this.#listeners.add(fn);
                return () => this.#listeners.delete(fn);
            },
        };
    }

    #getProblems(): AnyDiagnostic[] {
        return [...this.#configProblems, ...this.#tokenProblems];
    }

    #formatBlocks(problems: AnyDiagnostic[]) {
        return formatProblemBlocks(problems, {
            cwd: this.#root,
            entryFile: getTokensOnDisk(this.#loaded.config, this.#root).entryFile,
            configFile: this.#loaded.configFile,
            tokens: this.#tokens,
        });
    }

    #reportProblems(): void {
        for (const { severity, text } of this.#formatBlocks(this.#getProblems())) {
            if (severity === "error") this.#logger?.error(text);
            else this.#logger?.warn(text);
        }
    }

    #logUnexpectedError(error: unknown): void {
        this.#logger?.error(
            `[sugarcube] ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    #updateCSS(next: DesignTokens): boolean {
        this.#tokens = next;
        const generated = generateCSS(next, this.#loaded.config);
        this.#tokenProblems = generated.diagnostics;
        if (hasErrors(this.#getProblems())) return false;
        const utilities = generated.utilities ?? NO_UTILITIES;
        const sameUtilities = isDeepStrictEqual(
            [this.#lastGoodCSS.utilities.prefixes, this.#lastGoodCSS.utilities.safelist],
            [utilities.prefixes, utilities.safelist],
        );
        this.#lastGoodCSS = {
            css: generated.variables.map((file) => file.css).join("\n"),
            utilities,
        };
        return !sameUtilities;
    }

    async #reloadConfig(): Promise<void> {
        try {
            this.#loaded = await loadInternalConfig(
                {},
                { root: this.#root, lastConfigFile: this.#loaded.configFile },
            );
            this.#configProblems = [];
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            this.#configProblems = toConfigDiagnostics(error);
            this.#reportProblems();
            return;
        }
        await this.dtcgPlugin.api.reread();
    }

    async #handleRead(next: DesignTokens, read: ReadEvent): Promise<void> {
        const started = performance.now();
        const utilitiesChanged = this.#updateCSS(next);
        const css = performance.now() - started;
        this.#reportProblems();
        let reloaded: number | undefined;
        if (!hasErrors(this.#getProblems())) {
            if (utilitiesChanged) {
                const reloading = performance.now();
                await this.#unocss?.reloadConfig();
                reloaded = performance.now() - reloading;
            } else {
                this.#unocss?.invalidate();
            }
        }
        if (this.#isDebugging) {
            this.#logger?.info(
                formatTiming(read, { css, unocss: reloaded, rest: performance.now() - started }),
            );
        }
        for (const fn of this.#listeners) fn();
    }
}

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
    const state = new PluginState(options.unoOptions ?? {});

    const plugins: Plugin[] = [
        state.dtcgPlugin,
        {
            name: "sugarcube",
            config: (user) => state.start(user),
            configResolved(config) {
                state.useLogger(config.logger, config.command === "serve");
            },
            configureServer(dev) {
                state.watchConfig(dev.watcher);
            },
        } satisfies Plugin,

        {
            name: "sugarcube:build",
            apply: "build",
            buildStart() {
                const problems = state.formatBuildProblems();
                if (!problems) return;
                if (problems.hasErrors) this.error(problems.text);
                this.warn(problems.text);
            },
        } satisfies Plugin,

        ...state.unoPlugins,
        {
            name: "sugarcube:virtual-css",
            enforce: "pre",

            config() {
                return {
                    optimizeDeps: {
                        exclude: [VIRTUAL_CSS_ID],
                    },
                };
            },

            async resolveId(id) {
                // Variables included via preflight, utilities via rules
                if (id === VIRTUAL_CSS_ID) {
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
                getContext: () => state.context,
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
