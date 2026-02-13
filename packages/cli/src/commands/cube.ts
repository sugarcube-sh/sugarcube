import { mkdir } from "node:fs/promises";
import { Command } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import { collectCubeOverwriteWarnings } from "../fs/collect-overwrite-warnings.js";
import { formatOverwriteWarnings } from "../fs/format-overwrite-warnings.js";
import { installCUBE } from "../installation/index.js";
import { warningBoxWithBadge } from "../prompts/box-with-badge.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";
import { confirmOverwrite } from "../prompts/prompts.js";
import { CLIError } from "../types/index.js";
import { getCubeDir } from "../utils/config-helpers.js";
import { handleError } from "../utils/handle-error.js";

export const cube = new Command()
    .name("cube")
    .description("Add CUBE CSS to your project")
    .option("-s, --silent", "Suppress logs and prompts")
    .option("-f, --force", "Skip overwrite confirmation")
    .option("--cube-dir <dir>", "CUBE CSS output directory (defaults to cssRoot)")
    .action(async (options) => {
        try {
            if (!options.silent) {
                intro(label("CUBE CSS"));
            }

            const { directory: cssOutputDirectory } = await getCubeDir(options.cubeDir);

            try {
                await mkdir(cssOutputDirectory, { recursive: true });
            } catch (error) {
                const errorMessage = error instanceof Error ? `: ${error.message}` : "";
                throw new CLIError(`Failed to create output directory${errorMessage}`);
            }

            const warnings = await collectCubeOverwriteWarnings({
                cubeDirectory: cssOutputDirectory,
            });

            const warningMessage = formatOverwriteWarnings(warnings);
            if (warningMessage && !options.force && !options.silent) {
                log.space(1);
                const warningBox = warningBoxWithBadge(warningMessage, {});
                warningBox;
                await confirmOverwrite("Continue?", false);
            }

            const createdFiles = await installCUBE(cssOutputDirectory);

            if (!options.silent) {
                log.space(1);

                const allFiles = createdFiles;
                const uniqueFiles = [...new Set(allFiles)];
                const relativePaths = uniqueFiles.map((file) => relative(process.cwd(), file));

                const tasks = relativePaths.map((file) => ({
                    pending: `Write ${file}`,
                    start: `Writing ${file}`,
                    end: `Wrote ${file}`,
                    while: async () => {},
                }));

                await log.tasks(tasks, {
                    spacing: 0,
                    minDurationMs: 0,
                    successPauseMs: 100,
                    successMessage: "🎉 Files written!",
                });

                outro(color.green("CUBE added successfully."));
            }
        } catch (error) {
            handleError(error);
        }
    });
