import { existsSync } from "node:fs";
import path from "node:path";

export type ProjectInfo = {
    isSrcDir: boolean;
    tokensDir: string;
    stylesDir: string;
    componentDir: string;
};

export function hasSrcDir(cwd: string = process.cwd()): boolean {
    return existsSync(path.resolve(cwd, "src"));
}

export function getProjectInfo(cwd: string): ProjectInfo {
    const isSrcDir = hasSrcDir(cwd);

    return {
        isSrcDir,
        tokensDir: isSrcDir ? "src/design-tokens" : "design-tokens",
        stylesDir: isSrcDir ? "src/styles" : "styles",
        componentDir: isSrcDir ? "src/components/ui" : "components/ui",
    };
}
