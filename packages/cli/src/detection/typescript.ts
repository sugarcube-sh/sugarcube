import { getTsconfig } from "get-tsconfig";

export function isTypeScriptProject(cwd: string = process.cwd()): boolean {
    const tsconfig = getTsconfig(cwd);
    return tsconfig !== null;
}
