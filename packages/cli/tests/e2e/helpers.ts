import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const CLI_PATH = join(__dirname, "../../dist/index.mjs");
export const TEST_TIMEOUT = 60_000;
export const FIXTURES_PATH = join(__dirname, "__fixtures__");

export async function createPackageJson(dir: string): Promise<void> {
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "test-project", version: "1.0.0" })
    );
}

export async function createTokens(dir: string): Promise<string> {
    const tokensDir = join(dir, "design-tokens");
    await mkdir(tokensDir, { recursive: true });

    const resolverContent = await readFile(join(FIXTURES_PATH, "minimal.resolver.json"), "utf-8");
    await writeFile(join(tokensDir, "tokens.resolver.json"), resolverContent);

    return tokensDir;
}
