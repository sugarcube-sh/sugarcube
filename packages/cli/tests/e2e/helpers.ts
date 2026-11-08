import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { x } from "tinyexec";

export const CLI_PATH = join(__dirname, "../../dist/index.mjs");
export const TEST_TIMEOUT = 60_000;
export const FIXTURES_PATH = join(__dirname, "__fixtures__");
export const PLAIN_OUTPUT = { NO_COLOR: "1" };

export interface CliRun {
    stdout: string;
    stderr: string;
    exitCode: number | undefined;
}

export async function cli(
    args: string,
    {
        cwd,
        env,
        reject = true,
        timeout = TEST_TIMEOUT,
    }: { cwd: string; env?: Record<string, string>; reject?: boolean; timeout?: number },
): Promise<CliRun> {
    const result = await x("node", [CLI_PATH, ...args.split(" ").filter(Boolean)], {
        nodeOptions: { cwd, ...(env && { env }) },
        timeout,
        throwOnError: reject,
    });
    return {
        stdout: withoutFinalNewline(result.stdout),
        stderr: withoutFinalNewline(result.stderr),
        exitCode: result.exitCode,
    };
}

function withoutFinalNewline(text: string): string {
    return text.replace(/\r?\n$/, "");
}

export async function createPackageJson(dir: string): Promise<void> {
    await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ name: "test-project", version: "1.0.0" }),
    );
}

export async function createTokens(dir: string): Promise<string> {
    const tokensDir = join(dir, "design-tokens");
    await mkdir(tokensDir, { recursive: true });

    const resolverContent = await readFile(join(FIXTURES_PATH, "minimal.resolver.json"), "utf-8");
    await writeFile(join(tokensDir, "tokens.resolver.json"), resolverContent);

    return tokensDir;
}
