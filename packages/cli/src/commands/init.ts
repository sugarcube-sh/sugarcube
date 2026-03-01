import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { confirm, isCancel, select } from "@clack/prompts";
import { Command } from "commander";
import { basename, join } from "pathe";
import color from "picocolors";
import { detectExistingTokens } from "../detection/tokens.js";
import { writeTokenFiles } from "../fs/write-token-files.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import type { Task } from "../prompts/tasks.js";
import { welcome } from "../prompts/welcome.js";
import { fetchStarterKit } from "../registry/client.js";
import type { InitContext, InitOptions } from "../types/index.js";
import { handleError } from "../utils/handle-error.js";
import { preflightInit } from "../validation/preflight-init.js";
import { runComponents } from "./components.js";
import { runCube } from "./cube.js";

function getDefaultTokensDir(): string {
    return existsSync(resolve(process.cwd(), "src")) ? "src/design-tokens" : "design-tokens";
}

function isInteractive(): boolean {
    return Boolean(process.stdin.isTTY);
}

async function promptStarterKit(): Promise<string> {
    const choice = await select({
        message: "Choose a starter kit",
        options: [
            {
                label: "Fluid",
                value: "fluid",
                hint: "Responsive tokens with fluid scaling (recommended)",
            },
            {
                label: "Static",
                value: "static",
                hint: "Fixed-value tokens without fluid scaling",
            },
        ],
    });

    if (isCancel(choice)) {
        process.exit(0);
    }

    return choice as string;
}

async function promptConfirm(message: string): Promise<boolean> {
    if (!isInteractive()) return false;
    const result = await confirm({ message });
    if (isCancel(result)) {
        process.exit(0);
    }
    return result;
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
    .option("--kit <kit>", "Starter kit to use (fluid or static)")
    .option("--tokens-dir <dir>", "Design tokens directory")
    .option("--cube", "Add CUBE CSS (skips prompt)")
    .option("--components", "Add components (skips prompt, requires TTY for selection)")
    .action(async (options: InitOptions) => {
        try {
            await preflightInit();

            const tokensDir = options.tokensDir ?? getDefaultTokensDir();
            const hasExistingTokens = await detectExistingTokens(tokensDir);

            let starterKit: string | null = null;
            if (!hasExistingTokens) {
                starterKit = options.kit ?? null;
            }

            const ctx: InitContext = {
                options,
                tokensDir,
                hasExistingTokens,
                starterKit,
                sugarcubeConfig: {},
                createdFiles: [],
            };

            intro(label("sugarcube"));
            await welcome();

            if (!hasExistingTokens && !starterKit) {
                ctx.starterKit = await promptStarterKit();
            }

            const tokenTasks: Task[] = [];

            if (ctx.starterKit) {
                tokenTasks.push({
                    pending: "Add design tokens",
                    start: "Adding design tokens...",
                    end: "Design tokens added",
                    while: async () => {
                        await scaffoldTokens(ctx);
                    },
                });
            } else {
                tokenTasks.push({
                    pending: "Detect existing tokens",
                    start: "Detecting existing tokens...",
                    end: `Existing tokens found at ${tokensDir} - using those!`,
                    while: async () => {},
                });
            }

            await log.tasks(tokenTasks);

            // CUBE CSS
            const addCube =
                options.cube === true ||
                (options.cube == null && (await promptConfirm("Add CUBE CSS?")));
            if (addCube) {
                await runCube({ skipIntro: true, skipOutro: true });
            }

            // Components
            const addComponents =
                options.components === true ||
                (options.components == null && (await promptConfirm("Add components?")));
            if (addComponents && isInteractive()) {
                await runComponents([], { skipIntro: true, skipOutro: true });
            }

            outro(color.green("🎉 Project initialized!"));
        } catch (error) {
            handleError(error);
        }
    });
