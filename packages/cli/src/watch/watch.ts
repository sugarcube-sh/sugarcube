import {
    type CSSFileOutput,
    ConfigError,
    type LoadedConfig,
    type Reported,
    configProblems,
    plural,
    readOptions,
    writeCSSFiles,
} from "@sugarcube-sh/core";
import { type DocumentSource, liveDocument } from "@sugarcube-sh/dtcg/node";
import { type BuildOptions, type Built, buildFrom, filesOf, rescan } from "../build.js";
import { type ConfigFlags, loadConfig } from "../config.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { printProblems, whereOf } from "../problems.js";
import { errorPrefix, logRegenerated, prefix, warnPrefix } from "./log.js";
import { type Change, type Watched, startWatcher } from "./watcher.js";

export interface WatchFlags extends ConfigFlags {
    silent?: boolean;
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
}

export async function watch(flags: WatchFlags, first: LoadedConfig): Promise<void> {
    const options: BuildOptions = {
        variablesOnly: flags.variablesOnly,
        utilitiesOnly: flags.utilitiesOnly,
    };
    let loaded = first;
    let fromConfig: Reported[] = [];

    const onError = (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${errorPrefix} ${message}`);
    };
    const live = liveDocument(() => sourceOf(loaded), { onError });

    const written = async (built: Built, files: CSSFileOutput): Promise<boolean> => {
        const failed = printProblems([...fromConfig, ...built.diagnostics], whereOf(built), {
            onlyErrors: flags.silent,
            whenFailed: ERROR_MESSAGES.NO_CSS_WRITTEN(),
        });
        if (failed) return false;
        await writeCSSFiles(files);
        return true;
    };

    const started = performance.now();
    let last = await buildFrom(await live.document(), loaded, options);
    if (await written(last, filesOf(last))) {
        console.log(`${prefix} Generated in ${since(started)}ms`);
    }

    const configChanged = async (): Promise<Built | undefined> => {
        try {
            loaded = await loadConfig(flags);
            fromConfig = [];
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            fromConfig = configProblems(error);
            return last;
        }
        await live.reread();
        return undefined;
    };

    const rebuilt = (change: Change): Promise<Built | undefined> => {
        if (change.kind === "config") return configChanged();
        if (change.kind === "markup") return rescan(last);
        return buildFrom(change.doc, loaded, options, last);
    };

    const watcher = await startWatcher(live, loaded.configFile, watchedBy(last), {
        onChange: async (change) => {
            const begun = performance.now() - (change.kind === "token" ? change.read.ms : 0);
            const next = await rebuilt(change);
            if (next === undefined) return watchedBy(last);
            last = next;
            const files = change.kind === "markup" ? last.utilities : filesOf(last);
            if (await written(last, files)) {
                logRegenerated(savedFile(change, loaded), files, since(begun));
            }
            return watchedBy(last);
        },
        onError,
        onWarning: (message) => {
            console.log(`${warnPrefix} ${message}`);
        },
    });

    const tokenFiles = plural(last.doc.files.length, "token file");
    console.log(`${prefix} Watching ${tokenFiles} + markup files...`);

    process.on("SIGINT", async () => {
        await watcher.close();
        console.log(`${prefix} Watch mode stopped.`);
        process.exit(0);
    });

    await new Promise(() => {});
}

function sourceOf({ config }: LoadedConfig): DocumentSource {
    return { entry: config.resolver, options: readOptions(config) };
}

function savedFile(change: Change, { configFile }: LoadedConfig): string {
    if (change.kind !== "token") return change.path;
    return change.read.file ?? configFile ?? "";
}

function watchedBy({ config, generator }: Built): Watched {
    return { content: config.content, markup: generator !== undefined };
}

function since(start: number): number {
    return Math.round(performance.now() - start);
}
