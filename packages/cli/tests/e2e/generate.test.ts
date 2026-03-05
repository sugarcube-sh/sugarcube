import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson, createTokens } from "./helpers.js";

describe("generate command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-generate-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        await createPackageJson(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("writes to styles/ when no src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        const tokensDir = await createTokens(testDir);

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            }
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "styles/global"))).toBe(true);
        expect(existsSync(join(testDir, "src/styles"))).toBe(false);
    });

    it("writes to src/styles/ when src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        await mkdir(join(testDir, "src"), { recursive: true });
        const tokensDir = await createTokens(join(testDir, "src"));

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            }
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "src/styles/global"))).toBe(true);
    });

    it("respects --styles-dir flag", { timeout: TEST_TIMEOUT }, async () => {
        const tokensDir = await createTokens(testDir);

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json --styles-dir custom/css`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            }
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "custom/css/global"))).toBe(true);
    });
});
