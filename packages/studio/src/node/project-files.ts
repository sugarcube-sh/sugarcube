import { loadInternalConfig, formatProblems } from "@sugarcube-sh/core";
import { ErrorMessages } from "../error-messages";
import type { StudioFiles } from "../server/files";
import { createNodeFiles } from "../server/node-files";

export async function loadProjectFiles(): ReturnType<typeof createNodeFiles> {
    const { config } = await loadInternalConfig();
    return createNodeFiles(config, {
        onError: (error) => console.error(ErrorMessages.READ_FAILED, error),
    });
}

export function assertHasTokens(files: StudioFiles, cwd: string): void {
    const { config, tokens } = files.getSnapshot();
    if (tokens.getTokenPaths().length > 0) return;
    const problemContext = { cwd, entryFile: config.resolver, tokens };
    throw new Error(
        ErrorMessages.NOTHING_TO_BUILD(formatProblems(tokens.diagnostics, problemContext)),
    );
}
