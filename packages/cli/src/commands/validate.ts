import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { join, relative } from "pathe";
import color from "picocolors";
import { glob } from "tinyglobby";
import { type Built, build, buildFiles } from "../build.js";
import { CLIError } from "../cli-error.js";
import { loadConfig } from "../config.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { printProblems } from "../problems.js";
import { intro, label, outro } from "../prompts/common.js";

export const validate = new Command()
    .name("validate")
    .description("Validate design token files")
    .argument("[paths...]", "Token files or directories to validate (e.g., src/design-tokens)")
    .action(async (paths: string[]) => {
        try {
            intro(label("Validate"));
            const built =
                paths.length > 0
                    ? await builtFromPaths(paths)
                    : await build(await loadConfig(), { markup: false });
            if (printProblems(built)) {
                process.exitCode = 1;
                return;
            }
            outro(color.greenBright("All tokens valid ✨"));
        } catch (error) {
            handleError(error);
        }
    });

async function builtFromPaths(paths: string[]): Promise<Built> {
    for (const path of paths) {
        if (!existsSync(path)) throw new CLIError(ERROR_MESSAGES.VALIDATE_PATH_NOT_FOUND(path));
    }
    const patterns = paths.map((path) => (path.endsWith(".json") ? path : join(path, "**/*.json")));
    const found = await glob(patterns, { absolute: true });
    const files = found.map((file) => relative(process.cwd(), file)).sort();
    const resolvers = files.filter((file) => file.endsWith(".resolver.json"));
    if (resolvers.length > 1)
        throw new CLIError(ERROR_MESSAGES.VALIDATE_SEVERAL_RESOLVERS(resolvers));
    const [resolver] = resolvers;
    if (resolver) return build(await loadConfig({ resolver }), { markup: false });
    if (files.length === 0) throw new CLIError(ERROR_MESSAGES.VALIDATE_NO_TOKEN_FILES());
    const texts = await Promise.all(
        files.map(async (file) => [file, await readFile(file, "utf-8")]),
    );
    return buildFiles(Object.fromEntries(texts), process.cwd());
}
