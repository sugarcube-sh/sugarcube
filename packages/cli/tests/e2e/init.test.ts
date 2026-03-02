import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/index.mjs");

const TEST_TIMEOUT = 60_000;

describe("init command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("exits with error in non-TTY environment", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("interactive terminal");
    });
});
