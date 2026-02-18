import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { DEFAULT_CONFIG, loadInternalConfig } from "@sugarcube-sh/core";
import { Command } from "commander";
import { join, relative } from "pathe";
import color from "picocolors";
import { glob } from "tinyglobby";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { loadAndResolveTokensForCLI } from "../pipelines/load-and-resolve-for-cli.js";
import { intro, label, outro } from "../prompts/common.js";
import { CLIError } from "../types/index.js";
import { handleError } from "../utils/handle-error.js";

export const validate = new Command()
    .name("validate")
    .description("Validate design token files")
    .argument("[paths...]", "Token files or directories to validate (e.g., src/design-tokens)")
    .action(async (paths: string[]) => {
        try {
            intro(label("Validate"));

            // If no paths specified, try to load config
            if (!paths.length) {
                try {
                    const { config } = await loadInternalConfig();
                    await loadAndResolveTokensForCLI(config);
                    outro(color.greenBright("All tokens valid ✨"));
                    return;
                } catch {
                    // If config loading fails, require explicit paths
                    throw new CLIError(ERROR_MESSAGES.VALIDATE_NO_PATH_SPECIFIED());
                }
            }

            for (const p of paths) {
                if (!existsSync(p)) {
                    throw new CLIError(ERROR_MESSAGES.VALIDATE_PATH_NOT_FOUND(p));
                }
            }

            const files = await glob(
                paths.map((p) => (p.endsWith(".json") ? p : join(p, "**/*.json"))),
                {
                    absolute: true,
                }
            );

            // Filter out resolver files - they're not token files!
            const tokenFiles = files.filter((file) => !file.endsWith(".resolver.json"));

            if (tokenFiles.length === 0) {
                throw new CLIError(ERROR_MESSAGES.VALIDATE_NO_TOKEN_FILES());
            }

            const memoryData: Record<string, { set?: string; content: string }> = {};
            for (const file of tokenFiles) {
                const content = await readFile(file, "utf-8");
                const relativePath = relative(process.cwd(), file);
                memoryData[relativePath] = {
                    content,
                };
            }

            // Okay to use default config for standalone file validation
            const validationConfig = {
                output: DEFAULT_CONFIG.output,
                transforms: DEFAULT_CONFIG.transforms,
            };

            await loadAndResolveTokensForCLI(validationConfig, memoryData);

            outro(color.greenBright("All tokens valid ✨"));
        } catch (error) {
            handleError(error);
        }
    });
