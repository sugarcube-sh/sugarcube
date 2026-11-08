import { x } from "tinyexec";
import { CLIError } from "../cli-error.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import type { PackageManager } from "../types/install.js";

export async function installDependencies(
    dependencies: string[],
    targetDir: string,
    packageManager: PackageManager,
    options: { devDependency?: boolean } = {},
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
        await x(packageManager, [command, ...devFlag, ...dependencies], {
            nodeOptions: { cwd: targetDir },
            throwOnError: true,
        });
    } catch (error) {
        throw new CLIError(
            ERROR_MESSAGES.DEPENDENCY_INSTALL_FAILED(packageManager, failureText(error)),
            error instanceof Error ? error : undefined,
        );
    }
}

function failureText(error: unknown): string | undefined {
    if (!(error instanceof Error)) return undefined;
    const output = (error as Error & { output?: { stdout?: string; stderr?: string } }).output;
    return output?.stderr?.trim() || output?.stdout?.trim() || error.message.trim() || undefined;
}
