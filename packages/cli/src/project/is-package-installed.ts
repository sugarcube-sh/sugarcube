import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function isPackageInstalled(packageName: string, cwd: string = process.cwd()): boolean {
    try {
        const packagePath = resolve(cwd, "package.json");
        if (!existsSync(packagePath)) return false;

        const content = readFileSync(packagePath, "utf-8");
        const packageJson = JSON.parse(content);

        const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
        };

        return packageName in allDeps;
    } catch {
        return false;
    }
}
