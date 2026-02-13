import type { InternalConfig } from "@sugarcube-sh/core";
import { basename, join, relative, resolve } from "pathe";
import { fetchStarterKit } from "../registry/client.js";

interface StarterKitResult {
    config: InternalConfig;
    tokenFiles: Array<{ path: string; content: string }>;
    tokensDir: string;
    createdTokenPaths: string[];
}

export const prepareStarterKitForInstall = async (
    kitChoice: string,
    tokensOutputDirectory: string,
    config: InternalConfig
): Promise<StarterKitResult> => {
    const result = await fetchStarterKit(kitChoice);
    const absoluteTokensDir = resolve(process.cwd(), tokensOutputDirectory);

    const tokenFiles = result.files.map((file) => ({
        path: join(absoluteTokensDir, basename(file.path)),
        content: file.content,
    }));

    return {
        config,
        tokenFiles,
        tokensDir: absoluteTokensDir,
        createdTokenPaths: tokenFiles.map((f) => relative(process.cwd(), f.path)),
    };
};
