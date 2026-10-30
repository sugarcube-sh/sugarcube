import { loadInternalConfig, problemsText } from "@sugarcube-sh/core";
import { ErrorMessages } from "../error-messages";
import type { StudioFiles } from "../server/files";
import { nodeFiles } from "../server/node-files";

export async function projectFiles(): ReturnType<typeof nodeFiles> {
    const { config } = await loadInternalConfig();
    return nodeFiles(config, {
        onError: (error) => console.error(ErrorMessages.READ_FAILED, error),
    });
}

export function refuseEmpty(files: StudioFiles, cwd: string): void {
    const { config, tokens } = files.now();
    if (tokens.tokenPaths().length > 0) return;
    const where = { cwd, entry: config.resolver };
    throw new Error(ErrorMessages.NOTHING_TO_BUILD(problemsText(tokens.diagnostics, where)));
}
