import { existsSync } from "node:fs";
import { findTokenFiles } from "@sugarcube-sh/dtcg/node";

export async function detectExistingTokens(tokensDir: string): Promise<boolean> {
    if (!existsSync(tokensDir)) return false;
    return (await findTokenFiles(tokensDir)).tokenFiles.length > 0;
}
