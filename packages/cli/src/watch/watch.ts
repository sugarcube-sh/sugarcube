import {
    type CSSFileOutput,
    ConfigError,
    type LoadedConfig,
    type Reported,
    configProblems,
    plural,
    writeCSSFiles,
} from "@sugarcube-sh/core";
import { resolve } from "pathe";
import { type BuildOptions, type Built, build, filesOf, rescan } from "../build.js";
import { type ConfigFlags, loadConfig } from "../config.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { printProblems, whereOf } from "../problems.js";
import { errorPrefix, logRegenerated, prefix, warnPrefix } from "./log.js";
import { type ChangeKind, type Watched, startWatcher } from "./watcher.js";

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
    let last = await build(loaded, options);
    if (await written(last, filesOf(last))) {
        console.log(`${prefix} Generated in ${since(started)}ms`);
    }

    const rebuilt = async (kind: ChangeKind): Promise<Built> => {
        if (kind === "markup") return rescan(last, loaded.config);
        if (kind === "token") return build(loaded, options, last);
        try {
            loaded = await loadConfig(flags);
            fromConfig = [];
        } catch (error) {
            if (!(error instanceof ConfigError)) throw error;
            fromConfig = configProblems(error);
            return last;
        }
        return build(loaded, options);
    };

    const watcher = await startWatcher(watchedBy(last, loaded), {
        onChange: async (kind, changedPath) => {
            const begun = performance.now();
            last = await rebuilt(kind);
            const files = kind === "markup" ? last.utilities : filesOf(last);
            if (await written(last, files)) logRegenerated(changedPath, files, since(begun));
            await watcher.update(watchedBy(last, loaded));
        },
        onError: (error) => {
            console.error(`${errorPrefix} ${error.message}`);
        },
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

function watchedBy(
    { doc, folder, generator }: Built,
    { config, configFile }: LoadedConfig,
): Watched {
    return {
        tokens: doc.files.map((file) => resolve(folder, file)),
        config: configFile,
        content: config.content,
        markup: generator !== undefined,
    };
}

function since(start: number): number {
    return Math.round(performance.now() - start);
}
