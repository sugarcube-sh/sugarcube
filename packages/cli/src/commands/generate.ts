import { type InternalConfig, type LoadedConfig, writeCSSFiles } from "@sugarcube-sh/core";
import { Command } from "commander";
import color from "picocolors";
import { type ConfigFlags, loadConfig } from "../config.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import { printProblems, whereOf } from "../problems.js";
import { build } from "../build.js";
import { type GenerateAllCSSOptions, createWatchSession } from "../watch/regenerate.js";
import {
    errorPrefix,
    logRegenerated,
    logWarnings,
    outputPaths,
    prefix,
    warnPrefix,
} from "../watch/log.js";
import { startWatcher } from "../watch/watcher.js";

interface GenerateFlags extends ConfigFlags {
    force?: boolean;
    silent?: boolean;
    watch?: boolean;
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
}

async function logOneTimeResult(relativePaths: string[]): Promise<void> {
    const tasks = relativePaths.map((file) => ({
        pending: `Write ${file}`,
        start: `Writing ${file}`,
        end: `Wrote ${file}`,
        while: async () => {},
    }));
    await log.tasks(tasks, {
        spacing: 1,
        minDurationMs: 0,
        successPauseMs: 100,
        successMessage: "🎉 Files written!",
    });
    log.space(1);
    outro(color.green("CSS generated successfully."));
}

async function runOneTimeGeneration(loaded: LoadedConfig, options: GenerateFlags): Promise<void> {
    const built = await build(loaded, {
        variablesOnly: options.variablesOnly,
        utilitiesOnly: options.utilitiesOnly,
    });
    const failed = printProblems(built.diagnostics, whereOf(built), {
        onlyErrors: options.silent,
        whenFailed: ERROR_MESSAGES.NO_CSS_WRITTEN(),
    });
    if (failed) {
        process.exitCode = 1;
        return;
    }
    await writeCSSFiles(built.files);
    if (!options.silent) await logOneTimeResult(outputPaths(built.files));
}

async function runWatchMode(config: InternalConfig, options: GenerateFlags): Promise<void> {
    const generateOptions: GenerateAllCSSOptions = {
        variablesOnly: options.variablesOnly,
        utilitiesOnly: options.utilitiesOnly,
    };

    const session = createWatchSession(config, generateOptions);

    const startTime = performance.now();
    const { warnings: initialWarnings } = await session.primeAndBuild();
    const durationMs = Math.round(performance.now() - startTime);
    logWarnings(initialWarnings);
    console.log(`${prefix} Generated in ${durationMs}ms`);

    const watcher = await startWatcher(config, {
        onRegenerate: async (kind, changedPath: string) => {
            const regenStart = performance.now();
            const { output: regenOutput, warnings: regenWarnings } = await session.onChange(
                kind,
                changedPath,
            );
            const regenDurationMs = Math.round(performance.now() - regenStart);

            logWarnings(regenWarnings);
            logRegenerated(changedPath, regenOutput, regenDurationMs);
        },
        onError: (error: Error) => {
            console.error(`${errorPrefix} ${error.message}`);
        },
        onReady: (tokenFileCount: number) => {
            console.log(
                `${prefix} Watching ${tokenFileCount} token file${tokenFileCount === 1 ? "" : "s"} + markup files...`,
            );
        },
        onWarning: (message: string) => {
            console.log(`${warnPrefix} ${message}`);
        },
    });

    process.on("SIGINT", async () => {
        await watcher.close();
        console.log(`${prefix} Watch mode stopped.`);
        process.exit(0);
    });

    await new Promise(() => {});
}

export const generate = new Command()
    .name("generate")
    .description("Generate CSS from your design tokens")
    .option("--force", "Skip overwrite confirmation")
    .option("-s, --silent", "Suppress logs and prompts")
    .option("-w, --watch", "Watch for changes and regenerate automatically")
    .option("--resolver <path>", "Path to token resolver file (.resolver.json)")
    .option(
        "--variables <path>",
        "Output path for CSS variables (default: 'src/styles/tokens.css')",
    )
    .option(
        "--utilities <path>",
        "Output path for utility classes (default: 'src/styles/utilities.css')",
    )
    .option(
        "--fluid-min <number>",
        "Minimum viewport width for fluid scaling (default: 320)",
        Number,
    )
    .option(
        "--fluid-max <number>",
        "Maximum viewport width for fluid scaling (default: 1200)",
        Number,
    )
    .option(
        "--color-fallback <strategy>",
        "Color fallback strategy: 'native' or 'polyfill' (default: native)",
    )
    .option("--prefix <string>", "Prefix prepended to every generated CSS variable name")
    .option(
        "--input <modifier=value>",
        "Select a modifier context for this build (repeatable)",
        (value: string, previous: string[]) => previous.concat([value]),
        [] as string[],
    )
    .option("--selector <selector>", "CSS selector for --input output (default: ':root')")
    .option("--variables-only", "Generate only CSS variables, skip utilities")
    .option("--utilities-only", "Generate only utilities, skip CSS variables")
    .action(async (options: GenerateFlags) => {
        try {
            if (!options.silent && !options.watch) {
                intro(label("Generate CSS"));
            }

            const loaded = await loadConfig(options);
            if (options.watch) await runWatchMode(loaded.config, options);
            else await runOneTimeGeneration(loaded, options);
        } catch (error) {
            handleError(error);
        }
    });
