import { isTypeScriptProject } from "../detection/typescript.js";

export async function getConfigFileName(cwd: string = process.cwd()): Promise<string> {
    const isTS = isTypeScriptProject(cwd);
    return isTS ? "sugarcube.config.ts" : "sugarcube.config.js";
}
