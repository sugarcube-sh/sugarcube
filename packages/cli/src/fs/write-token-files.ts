import fs from "node:fs/promises";

export interface TokenFile {
    path: string;
    content: string;
}

export async function writeTokenFiles(
    tokenFiles: TokenFile[],
    tokensDir: string
): Promise<string[]> {
    await fs.mkdir(tokensDir, { recursive: true });

    const createdFiles: string[] = [];
    for (const file of tokenFiles) {
        await fs.writeFile(file.path, file.content);
        createdFiles.push(file.path);
    }

    return createdFiles;
}
