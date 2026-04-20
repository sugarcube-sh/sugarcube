import { execa } from "execa";
import { CLIError } from "../cli-error.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import type { PackageManager } from "../types/install.js";

export async function installDependencies(
    dependencies: string[],
    targetDir: string,
    packageManager: PackageManager,
    options: { devDependency?: boolean } = {}
) {
    if (dependencies.length === 0) {
        return;
    }

    const { devDependency = false } = options;
    const command = packageManager === "npm" ? "install" : "add";

    const devFlag = (() => {
        if (!devDependency) return [];
        switch (packageManager) {
            case "npm":
                return ["--save-dev"];
            case "pnpm":
                return ["-D"];
            case "yarn":
                return ["-D"];
            case "bun":
                return ["-d"];
        }
    })();

    try {
        await execa(packageManager, [command, ...devFlag, ...dependencies], {
            cwd: targetDir,
        });
    } catch (error) {
        const stderr = extractStderr(error);
        throw new CLIError(
            ERROR_MESSAGES.DEPENDENCY_INSTALL_FAILED(packageManager, stderr),
            error instanceof Error ? error : undefined
        );
    }
}

function extractStderr(error: unknown): string | undefined {
    if (!(error instanceof Error)) return undefined;
    const stderr = (error as Error & { stderr?: string }).stderr;
    return stderr?.trim() || error.message.trim() || undefined;
}
