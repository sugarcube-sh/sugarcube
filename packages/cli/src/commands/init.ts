import { resolve } from "node:path";
import { isCancel, select } from "@clack/prompts";
import { Command } from "commander";
import { basename, join } from "pathe";
import color from "picocolors";
import { CLI_PACKAGE, VITE_PLUGIN } from "../constants/index.js";
import { getProjectInfo } from "../detection/framework.js";
import { isPackageInstalled } from "../detection/is-package-installed.js";
import { getPackageManager } from "../detection/package-manager.js";
import { detectExistingTokens } from "../detection/tokens.js";
import { writeTokenFiles } from "../fs/write-token-files.js";
import { installDependencies } from "../installation/index.js";
import { intro, label } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import { next } from "../prompts/next-steps.js";
import type { Task } from "../prompts/tasks.js";
import { welcome } from "../prompts/welcome.js";
import { fetchStarterKit } from "../registry/client.js";
import type { InitContext, InitOptions } from "../types/index.js";
import { handleError } from "../utils/handle-error.js";
import { preflightInit } from "../validation/preflight-init.js";
import { runComponents } from "./components.js";
import { runCube } from "./cube.js";

async function promptStarterKit(): Promise<string> {
    const choice = await select({
        message: "Choose a token starter kit",
        options: [
            {
                label: "Fluid",
                value: "fluid",
                hint: "Fluid spacing and typography",
            },
            {
                label: "Static",
                value: "static",
                hint: "Fixed spacing and typography",
            },
        ],
    });

    if (isCancel(choice)) {
        process.exit(0);
    }

    return choice as string;
}

async function promptOptional(message: string, skipHint: string): Promise<boolean> {
    const result = await select({
        message,
        options: [
            { label: "Add", value: true },
            { label: "Skip", value: false, hint: skipHint },
        ],
    });
    if (isCancel(result)) {
        process.exit(0);
    }
    return result as boolean;
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
    .option("--tokens-dir <dir>", "Design tokens directory")
    .option("--cube-dir <dir>", "CUBE CSS output directory")
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
            const tokensDir = options.tokensDir ?? defaultTokensDir;
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

            // 1. Tokens
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

            // 2. CUBE CSS
            const addCube = await promptOptional(
                "CUBE CSS?",
                `you can add it later with ${color.cyan("sugarcube cube")}`
            );
            if (addCube) {
                await runCube({
                    skipIntro: true,
                    skipOutro: true,
                    continueOnDecline: true,
                    cubeDir: options.cubeDir,
                });
            }

            // 3. Components
            const addComponents = await promptOptional(
                "Components?",
                `you can add them later with ${color.cyan("sugarcube components")}`
            );
            if (addComponents) {
                await runComponents([], {
                    skipIntro: true,
                    skipOutro: true,
                    continueOnDecline: true,
                });
            }

            // 4. Vite plugin
            const installVite = await promptOptional(
                `Vite plugin? ${color.dim("(recommended for Vite-based frameworks: Astro, SvelteKit, Nuxt...)")}`,
                `you can install it later with ${color.cyan("npm i -D @sugarcube-sh/vite")}`
            );

            // 5. Install dependencies
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
