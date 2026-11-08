import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { findResolver, findTokenFiles } from "@sugarcube-sh/dtcg/node";
import { Command } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import { type Built, build, buildFiles } from "../build.js";
import { CLIError } from "../cli-error.js";
import { loadConfig } from "../config.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { printProblems, whereOf } from "../problems.js";
import { intro, label, outro } from "../prompts/common.js";

export const validate = new Command()
    .name("validate")
    .description("Check your token files for errors")
    .argument("[paths...]", "Token files or directories to validate (e.g., src/design-tokens)")
    .action(async (paths: string[]) => {
        try {
            intro(label("Validate"));
            const built =
                paths.length > 0
                    ? await builtFromPaths(paths)
                    : await build(await loadConfig(), { markup: false });
            if (printProblems(built.diagnostics, whereOf(built))) {
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
    const shown = (path: string) => relative(process.cwd(), path);
    const resolver = await findResolver(paths, { by: "content" });
    if (resolver.kind === "several") {
        throw new CLIError(ERROR_MESSAGES.VALIDATE_SEVERAL_RESOLVERS(resolver.paths.map(shown)));
    }
    if (resolver.kind === "one") {
        return build(await loadConfig({ resolver: shown(resolver.path) }), { markup: false });
    }
    const named = paths.filter((path) => !statSync(path).isDirectory());
    const { tokenFiles, otherFiles } = await findTokenFiles(
        paths.filter((path) => statSync(path).isDirectory()),
    );
    const files = [...new Set([...named, ...tokenFiles].map(shown))].sort();
    const [file, ...others] = files;
    if (file === undefined) {
        throw new CLIError(ERROR_MESSAGES.VALIDATE_NO_TOKEN_FILES(otherFiles.map(shown)));
    }
    if (others.length > 0) throw new CLIError(ERROR_MESSAGES.VALIDATE_NO_RESOLVER(files));
    return buildFiles({ [file]: await readFile(file, "utf-8") }, file);
}
