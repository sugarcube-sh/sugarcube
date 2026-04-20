import { resolve } from "node:path";
import { configFileExists } from "@sugarcube-sh/core";
import { Command } from "commander";
import { basename, join } from "pathe";
import color from "picocolors";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { CLI_PACKAGE, VITE_PLUGIN } from "../constants/plugins.js";
import { handleError } from "../handle-error.js";
import { installDependencies } from "../installation/dependencies.js";
import { getProjectInfo } from "../project/framework.js";
import { isPackageInstalled } from "../project/is-package-installed.js";
import { getPackageManager } from "../project/package-manager.js";
import { detectExistingTokens } from "../project/tokens.js";
import { errorBoxWithBadge } from "../prompts/box-with-badge.js";
import { intro, label } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import { next } from "../prompts/next-steps.js";
import { promptOptional, promptStarterKit } from "../prompts/prompts.js";
import type { Task } from "../prompts/tasks.js";
import { welcome } from "../prompts/welcome.js";
import { fetchStarterKit } from "../registry/client.js";
import type { InitContext, InitOptions } from "../types/commands.js";
import { writeTokenFiles } from "../write-token-files.js";
import { runComponents } from "./components.js";
import { runCube } from "./cube.js";

async function preflightInit(): Promise<void> {
    if (configFileExists()) {
        errorBoxWithBadge(ERROR_MESSAGES.CONFIG_EXISTS(), {});
        process.exit(1);
    }
}

async function scaffoldTokens(ctx: InitContext): Promise<void> {
    if (!ctx.starterKit) return;

    const absoluteTokensDir = resolve(process.cwd(), ctx.tokensDir);
    const result = await fetchStarterKit(ctx.starterKit);

    const tokenFiles = result.files.map((file) => ({
        path: join(absoluteTokensDir, basename(file.path)),
        content: file.content,
    }));

    const createdFiles = await writeTokenFiles(tokenFiles, absoluteTokensDir);
    ctx.createdFiles.push(...createdFiles);
}

export const init = new Command()
    .name("init")
    .description("Initialize a new sugarcube project")
    .option("--tokens <dir>", "Design tokens directory")
    .option("--cube <dir>", "CUBE CSS output directory")
    .option("--components <dir>", "Components output directory")
    .action(async (options: InitOptions) => {
        try {
            if (!process.stdin.isTTY) {
                console.error(
                    "init requires an interactive terminal. Use individual commands (cube, components, generate) for CI."
                );
                process.exit(1);
            }

            await preflightInit();

            const { tokensDir: defaultTokensDir } = getProjectInfo(process.cwd());
            const tokensDir = options.tokens ?? defaultTokensDir;
            const hasExistingTokens = await detectExistingTokens(tokensDir);

            const ctx: InitContext = {
                options,
                tokensDir,
                hasExistingTokens,
                starterKit: null,
                sugarcubeConfig: {},
                createdFiles: [],
            };

            intro(label("sugarcube"));
            await welcome();

            const detectionTasks: Task[] = [
                {
                    pending: "Detect existing tokens",
                    start: "Detecting existing tokens...",
                    end: hasExistingTokens
                        ? `Existing design tokens found at ${tokensDir} — using those!`
                        : "No existing design tokens found — prompting for starter kit",
                    while: async () => {},
                },
            ];

            await log.tasks(detectionTasks);

            if (!hasExistingTokens) {
                ctx.starterKit = await promptStarterKit();
            }

            if (ctx.starterKit) {
                await log.tasks([
                    {
                        pending: "Add design tokens",
                        start: "Adding design tokens...",
                        end: "Design tokens added",
                        while: async () => {
                            await scaffoldTokens(ctx);
                        },
                    },
                ]);
            }

            const addCube = await promptOptional(
                "CUBE CSS?",
                `you can add it later with ${color.cyan("sugarcube cube")}`
            );
            if (addCube) {
                await runCube({
                    skipIntro: true,
                    skipOutro: true,
                    continueOnDecline: true,
                    output: options.cube,
                });
            }

            const addComponents = await promptOptional(
                "Components?",
                `you can add them later with ${color.cyan("sugarcube components")}`
            );
            if (addComponents) {
                await runComponents([], {
                    skipIntro: true,
                    skipOutro: true,
                    continueOnDecline: true,
                    output: options.components,
                });
            }

            const installVite = await promptOptional(
                `Vite plugin? ${color.dim("(recommended for Vite-based frameworks: Astro, SvelteKit...)")}`,
                `you can install it later: ${color.cyan("@sugarcube-sh/vite")}`
            );

            const packageManager = await getPackageManager(process.cwd(), {
                withFallback: true,
            });

            const depsToInstall: string[] = [];

            if (!isPackageInstalled(CLI_PACKAGE, process.cwd())) {
                depsToInstall.push(CLI_PACKAGE);
            }
            if (installVite) {
                depsToInstall.push(VITE_PLUGIN);
            }

            if (depsToInstall.length > 0) {
                await log.tasks([
                    {
                        pending: `Install ${depsToInstall.join(", ")}`,
                        start: `Installing ${depsToInstall.join(", ")}...`,
                        end: `Installed ${depsToInstall.join(", ")}`,
                        while: async () => {
                            await installDependencies(
                                depsToInstall,
                                process.cwd(),
                                packageManager,
                                { devDependency: true }
                            );
                        },
                    },
                ]);
            }

            log.success("🎉 Project initialized!");

            await next({ installedVitePlugin: installVite });
        } catch (error) {
            handleError(error);
        }
    });
