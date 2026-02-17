import {
    type InternalConfig,
    type SugarcubeConfig,
    fillDefaults,
    findResolverDocument,
} from "@sugarcube-sh/core";
import {
    generateCSSVariables,
    processAndConvertTokens,
    writeCSSUtilitiesToDisk,
    writeCSSVariablesToDisk,
} from "@sugarcube-sh/core";
import { Command } from "commander";
import { buildSugarcubeConfig } from "../config/builder.js";
import {
    CLI_PACKAGE,
    DEFAULT_STARTER_KIT,
    ERROR_MESSAGES,
    VITE_PLUGIN,
} from "../constants/index.js";
import { type Framework, getProjectInfo, shouldInstallVitePlugin } from "../detection/framework.js";
import { isPackageInstalled } from "../detection/is-package-installed.js";
import { getPackageManager } from "../detection/package-manager.js";
import { detectExistingTokens } from "../detection/tokens.js";
import { writeSugarcubeConfig } from "../fs/write-config.js";
import { installDependencies, installFromStarterKit } from "../installation/index.js";
import { loadAndResolveTokensForCLI } from "../pipelines/load-and-resolve-for-cli.js";
import { intro, label, unicodeOr } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import { next } from "../prompts/next-steps.js";
import type { Task } from "../prompts/tasks.js";
import { welcome } from "../prompts/welcome.js";
import { CLIError } from "../types/errors.js";
import type {
    InitContext,
    InitOptions,
    InstallationTargets,
    ProjectContext,
    TypeSource,
} from "../types/index.js";
import { getConfigFileName } from "../utils/config-filename.js";
import { handleError } from "../utils/handle-error.js";
import { validateOptions } from "../validation/index.js";
import { preflightInit } from "../validation/preflight-init.js";
import { generateSugarcubeUtilities } from "./generate.js";

async function initializeProjectContext(options: InitOptions): Promise<{
    tokensDir: string;
    stylesDir: string;
    isSrcDir: boolean;
    hasExistingTokens: boolean;
    resolverPath: string | null;
    framework: Framework;
}> {
    const projectInfo = getProjectInfo(process.cwd());

    const tokensDir = options.tokensDir || projectInfo.tokensDir;
    const stylesDir = options.stylesDir || projectInfo.stylesDir;
    const hasExistingTokens = await detectExistingTokens(tokensDir);

    // If existing tokens, look for resolver document
    let resolverPath: string | null = null;
    if (hasExistingTokens) {
        const discovery = await findResolverDocument(tokensDir);
        if (discovery.found === "none") {
            throw new CLIError(ERROR_MESSAGES.RESOLVER_NOT_FOUND(tokensDir));
        }
        if (discovery.found === "multiple") {
            throw new CLIError(ERROR_MESSAGES.RESOLVER_MULTIPLE_FOUND(discovery.paths));
        }
        resolverPath = discovery.path;
    }

    return {
        tokensDir,
        stylesDir,
        isSrcDir: projectInfo.isSrcDir,
        hasExistingTokens,
        resolverPath,
        framework: projectInfo.framework,
    };
}

function determineInstallationTargets(
    options: InitOptions,
    hasExistingTokens: boolean,
    framework: Framework
): InstallationTargets {
    const starterKit = hasExistingTokens ? null : options.kit || DEFAULT_STARTER_KIT;

    if (options.skipDeps) {
        return { starterKit, pluginToInstall: null, cliToInstall: null };
    }

    const pluginToInstall = determinePlugin(framework, process.cwd());
    const cliToInstall = pluginToInstall ? null : CLI_PACKAGE;

    return { starterKit, pluginToInstall, cliToInstall };
}

function determinePlugin(framework: Framework, cwd: string): string | null {
    return shouldInstallVitePlugin(framework, cwd) ? VITE_PLUGIN : null;
}

async function buildInitContext(
    options: InitOptions,
    projectContext: ProjectContext,
    config: InternalConfig,
    sugarcubeConfig: SugarcubeConfig,
    installationTargets: InstallationTargets
): Promise<InitContext> {
    const packageManager = await getPackageManager(process.cwd(), { withFallback: true });

    // Add discovered resolver path to config (deliberately (for now) not passed through options/sugarcubeConfig)
    if (projectContext.resolverPath) {
        config.resolver = projectContext.resolverPath;
    }

    return {
        options,
        ...projectContext,
        isSrcDir: projectContext.isSrcDir,
        config,
        sugarcubeConfig,
        ...installationTargets,
        packageManager,
        createdFiles: [],
        createdDirectories: [],
        installedDependencies: [],
        tasks: [],
    };
}

async function processExistingTokens(ctx: InitContext): Promise<void> {
    const { trees, resolved } = await loadAndResolveTokensForCLI(ctx.config);
    ctx.setupResult = {
        config: ctx.config,
        createdTokenPaths: [],
        trees,
        resolved,
        tokenFiles: [],
        tokensDir: ctx.tokensDir,
    };
}

async function setupDesignTokens(ctx: InitContext): Promise<void> {
    if (!ctx.hasExistingTokens && ctx.starterKit) {
        await installFromStarterKit(ctx);
    } else {
        await processExistingTokens(ctx);
    }
}

async function writeCSSVariables(ctx: InitContext): Promise<void> {
    if (!ctx.setupResult) {
        throw new CLIError(ERROR_MESSAGES.INITIALIZATION_INCOMPLETE());
    }

    const { trees, resolved } = ctx.setupResult;
    const convertedTokens = await processAndConvertTokens(trees, resolved, ctx.config);
    const cssVars = await generateCSSVariables(convertedTokens, ctx.config);
    await writeCSSVariablesToDisk(cssVars);
}

async function writeCSSUtilities(ctx: InitContext): Promise<void> {
    if (!ctx.setupResult) {
        throw new CLIError(ERROR_MESSAGES.INITIALIZATION_INCOMPLETE());
    }

    const { trees, resolved } = ctx.setupResult;
    const convertedTokens = await processAndConvertTokens(trees, resolved, ctx.config);
    const utilities = await generateSugarcubeUtilities(convertedTokens, ctx.config);
    if (utilities.length) {
        await writeCSSUtilitiesToDisk(utilities);
    }
}

async function installPlugins(ctx: InitContext): Promise<void> {
    if (!ctx.pluginToInstall) return;

    if (isPackageInstalled(ctx.pluginToInstall)) {
        return;
    }

    try {
        await installDependencies([ctx.pluginToInstall], process.cwd(), ctx.packageManager, {
            devDependency: true,
        });
        ctx.installedDependencies.push(ctx.pluginToInstall);
    } catch (error) {
        throw new CLIError(
            ERROR_MESSAGES.PLUGIN_INSTALL_FAILED({
                pluginToInstall: ctx.pluginToInstall,
                packageManager: ctx.packageManager,
            })
        );
    }
}

async function installCLI(ctx: InitContext): Promise<void> {
    if (!ctx.cliToInstall) return;

    if (isPackageInstalled(ctx.cliToInstall)) {
        return;
    }

    try {
        await installDependencies([ctx.cliToInstall], process.cwd(), ctx.packageManager, {
            devDependency: true,
        });
        ctx.installedDependencies.push(ctx.cliToInstall);
    } catch (error) {
        throw new CLIError(
            ERROR_MESSAGES.CLI_INSTALL_FAILED({
                packageManager: ctx.packageManager,
            })
        );
    }
}

function hasCustomizationFlags(options: InitOptions): boolean {
    return !!(
        options.stylesDir ||
        options.variablesDir ||
        options.variablesFilename ||
        options.utilitiesDir ||
        options.utilitiesFilename ||
        options.fluidMin ||
        options.fluidMax ||
        options.colorFallback
    );
}

function getTypeSource(ctx: InitContext): TypeSource {
    if (ctx.pluginToInstall) return "@sugarcube-sh/vite";
    if (ctx.cliToInstall) return "@sugarcube-sh/cli";
    return null;
}

async function finalize(ctx: InitContext): Promise<void> {
    if (hasCustomizationFlags(ctx.options)) {
        try {
            await writeSugarcubeConfig(ctx.sugarcubeConfig, getTypeSource(ctx));
            const configFileName = await getConfigFileName();
            ctx.createdFiles.push(configFileName);
        } catch (error) {
            throw new CLIError(ERROR_MESSAGES.CONFIG_WRITE_FAILED());
        }
    }
}

function buildDetectionTasks(ctx: InitContext): Task[] {
    const summaryTasks: Task[] = [];

    if (ctx.hasExistingTokens) {
        summaryTasks.push({
            pending: "Looking for existing tokens",
            start: "Looking for existing tokens...",
            end: `Existing tokens found at ${ctx.tokensDir} ${unicodeOr("→", "->")} using them`,
            while: async () => {
                // No-op, just for display
            },
        });
    } else if (ctx.starterKit) {
        summaryTasks.push({
            pending: "Looking for existing tokens",
            start: "Looking for existing tokens...",
            end: `No existing tokens detected ${unicodeOr("→", "->")} adding starter kit`,
            while: async () => {
                // No-op, just for display
            },
        });
    }

    if (ctx.pluginToInstall) {
        const pluginName = "Vite";
        if (isPackageInstalled(ctx.pluginToInstall)) {
            summaryTasks.push({
                pending: `Checking for ${pluginName} compatibility`,
                start: `Checking for ${pluginName} compatibility...`,
                end: `${pluginName} plugin already installed ${unicodeOr("→", "->")} skipping plugin installation`,
                while: async () => {
                    // No-op, just for display
                },
            });
        } else {
            summaryTasks.push({
                pending: "Checking for Vite compatibility",
                start: "Checking for Vite compatibility...",
                end: `Vite detected ${unicodeOr("→", "->")} plugin will be installed`,
                while: async () => {
                    // No-op, just for display
                },
            });
        }
    } else {
        const depsSkipped = ctx.options.skipDeps;
        summaryTasks.push({
            pending: "Checking for Vite compatibility",
            start: "Checking for Vite compatibility...",
            end: depsSkipped
                ? `Dependencies skipped ${unicodeOr("→", "->")} no plugins or CLI will be installed`
                : `No Vite detected ${unicodeOr("→", "->")} CSS will be generated as file(s)`,
            while: async () => {
                // No-op, just for display
            },
        });
    }

    return summaryTasks;
}

async function buildExecutionTasks(ctx: InitContext): Promise<void> {
    ctx.tasks.push({
        pending: ctx.hasExistingTokens ? "Process existing design tokens" : "Add design tokens",
        start: ctx.hasExistingTokens
            ? "Processing existing design tokens..."
            : "Adding design tokens...",
        end: ctx.hasExistingTokens ? "Design tokens processed" : "Design tokens added",
        while: async () => {
            await setupDesignTokens(ctx);
        },
    });

    if (!ctx.pluginToInstall) {
        ctx.tasks.push({
            pending: "Generate CSS variables",
            start: "Generating CSS variables...",
            end: "CSS variables generated",
            while: async () => {
                await writeCSSVariables(ctx);
            },
        });

        ctx.tasks.push({
            pending: "Generate CSS utilities",
            start: "Generating CSS utilities...",
            end: "CSS utilities generated",
            while: async () => {
                await writeCSSUtilities(ctx);
            },
        });

        if (ctx.cliToInstall && !isPackageInstalled(ctx.cliToInstall)) {
            ctx.tasks.push({
                pending: "Install CLI",
                start: "Installing CLI...",
                end: "CLI installed",
                while: async () => {
                    await installCLI(ctx);
                },
            });
        }
    } else {
        if (ctx.pluginToInstall && !isPackageInstalled(ctx.pluginToInstall)) {
            const pluginName = "Vite";
            ctx.tasks.push({
                pending: `Install ${pluginName} plugin`,
                start: `Installing ${pluginName} plugin...`,
                end: `${pluginName} plugin installed`,
                while: async () => {
                    await installPlugins(ctx);
                },
            });
        }
        // If plugin is already installed, it's already shown in the summary tasks
        // No need to add it to the task queue
    }

    // Only add config task if we're going to write it
    if (hasCustomizationFlags(ctx.options)) {
        ctx.tasks.push({
            pending: "Write configuration file",
            start: "Writing configuration file...",
            end: "Configuration file written",
            while: async () => {
                await finalize(ctx);
            },
        });
    } else {
        // Still call finalize, but no task since we're not writing anything
        ctx.tasks.push({
            pending: "Finalize setup",
            start: "Finalizing...",
            end: "Setup complete",
            while: async () => {
                await finalize(ctx);
            },
        });
    }
}

export const init = new Command()
    .name("init")
    .description("Initialize a new sugarcube project")
    .option(
        "--kit <kit>",
        `Starter kit to use (default: ${DEFAULT_STARTER_KIT})`,
        DEFAULT_STARTER_KIT
    )
    .option("--tokens-dir <dir>", "Design tokens directory (e.g., 'src/design-tokens')")
    .option("--styles-dir <dir>", "Styles output directory (e.g., 'src/styles')")
    .option("--variables-dir <dir>", "Token variables directory (e.g., 'src/styles/global')")
    .option(
        "--variables-filename <name>",
        "Token variables filename (default: 'tokens.variables.gen.css')"
    )
    .option("--utilities-dir <dir>", "Utilities directory (e.g., 'src/styles/utilities')")
    .option("--utilities-filename <name>", "Utilities filename (default: 'utilities.gen.css')")
    .option("--fluid-min <number>", "Minimum viewport width for fluid scaling (default: 320)")
    .option("--fluid-max <number>", "Maximum viewport width for fluid scaling (default: 1200)")
    .option(
        "--color-fallback <strategy>",
        "Color fallback strategy: 'native' or 'polyfill' (default: native)"
    )
    .option("--skip-deps", "Don't install any sugarcube packages")
    .action(async (options: InitOptions) => {
        let ctx: InitContext;

        try {
            validateOptions(options);

            await preflightInit();

            const projectContext = await initializeProjectContext(options);

            const sugarcubeConfig = await buildSugarcubeConfig(options);

            const internalConfig = fillDefaults(sugarcubeConfig);
            const installationTargets = determineInstallationTargets(
                options,
                projectContext.hasExistingTokens,
                projectContext.framework
            );
            ctx = await buildInitContext(
                options,
                projectContext,
                internalConfig,
                sugarcubeConfig,
                installationTargets
            );

            intro(label("sugarcube"));

            await welcome();

            const summaryTasks = buildDetectionTasks(ctx);
            if (summaryTasks.length > 0) {
                log.message("Detecting project…");
                await log.tasks(summaryTasks, { minDurationMs: 1000 });
            }

            // Need to reset tasks array else the tasks will be added to the detection tasks
            ctx.tasks = [];
            await buildExecutionTasks(ctx);

            if (ctx.tasks.length > 0) {
                log.message("Setting things up…");
                await log.tasks(ctx.tasks, { successMessage: "🎉 Tasks completed successfully!" });
            }

            await next(ctx);
        } catch (error) {
            handleError(error);
        }
    });
