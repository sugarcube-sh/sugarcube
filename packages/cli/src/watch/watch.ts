import {
    type CSSFileOutput,
    ConfigError,
    type LoadedConfig,
    type AnyDiagnostic,
    toConfigDiagnostics,
    pluralize,
    getTokensOnDisk,
    writeCSSFiles,
} from "@sugarcube-sh/core";
import { createLiveTokens } from "@sugarcube-sh/dtcg/node";
import {
    type BuildOptions,
    type BuildResult,
    buildFromTokens,
    getOutputFiles,
    rescan,
} from "../build.js";
import { type ConfigFlags, loadConfig } from "../config.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { printProblems, getProblemContext } from "../problems.js";
import { errorPrefix, logRegenerated, prefix, warnPrefix } from "./log.js";
import { type WatchChange, type WatchTargets, startWatcher } from "./watcher.js";

export interface WatchFlags extends ConfigFlags {
    silent?: boolean;
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
}

export async function watch(flags: WatchFlags, initialConfig: LoadedConfig): Promise<void> {
    const options: BuildOptions = {
        variablesOnly: flags.variablesOnly,
        utilitiesOnly: flags.utilitiesOnly,
    };
    let loaded = initialConfig;
    let configProblems: AnyDiagnostic[] = [];

    const onError = (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${errorPrefix} ${message}`);
    };
    const live = createLiveTokens(() => getTokensOnDisk(loaded.config), { onError });

    const writeIfValid = async (built: BuildResult, files: CSSFileOutput): Promise<boolean> => {
        const failed = printProblems(
            [...configProblems, ...built.diagnostics],
            getProblemContext(built),
            {
                onlyErrors: flags.silent,
                failureText: ErrorMessages.NO_CSS_WRITTEN(),
            },
        );
        if (failed) return false;
        await writeCSSFiles(files);
        return true;
    };

    const started = performance.now();
    let last = await buildFromTokens(await live.getTokens(), loaded, options);
    if (await writeIfValid(last, getOutputFiles(last))) {
        console.log(`${prefix} Generated in ${getElapsedMs(started)}ms`);
    }

    const reloadConfig = async (): Promise<BuildResult | undefined> => {
        try {
            loaded = await loadConfig(flags, loaded.configFile);
            configProblems = [];
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            configProblems = toConfigDiagnostics(error);
            return last;
        }
        await live.reread();
        return undefined;
    };

    const rebuild = (change: WatchChange): Promise<BuildResult | undefined> => {
        if (change.kind === "config") return reloadConfig();
        if (change.kind === "markup") return rescan(last);
        return buildFromTokens(change.tokens, loaded, options, last);
    };

    const watcher = await startWatcher(live, process.cwd(), getWatchTargets(last), {
        onChange: async (change) => {
            const startTime = performance.now() - (change.kind === "token" ? change.read.ms : 0);
            const next = await rebuild(change);
            if (next === undefined) return getWatchTargets(last);
            last = next;
            const files = change.kind === "markup" ? last.utilities : getOutputFiles(last);
            if (await writeIfValid(last, files)) {
                logRegenerated(getChangedFile(change, loaded), files, getElapsedMs(startTime));
            }
            return getWatchTargets(last);
        },
        onError,
        onWarning: (message) => {
            console.log(`${warnPrefix} ${message}`);
        },
    });

    const tokenFiles = pluralize(last.tokens.files.length, "token file");
    console.log(`${prefix} Watching ${tokenFiles} + markup files...`);

    process.on("SIGINT", async () => {
        await watcher.close();
        console.log(`${prefix} Watch mode stopped.`);
        process.exit(0);
    });

    await new Promise(() => {});
}

function getChangedFile(change: WatchChange, { configFile }: LoadedConfig): string {
    if (change.kind !== "token") return change.path;
    return change.read.file ?? configFile ?? "";
}

function getWatchTargets({ config, uno }: BuildResult): WatchTargets {
    return { content: config.content, markup: uno !== undefined };
}

function getElapsedMs(start: number): number {
    return Math.round(performance.now() - start);
}
