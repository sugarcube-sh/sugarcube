import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

describe("init command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-init-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        await createPackageJson(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("exits with error in non-TTY environment", { timeout: TEST_TIMEOUT }, async () => {
        const result = await execaCommand(`node ${CLI_PATH} init`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("interactive terminal");
    });

    it("suggests using individual commands for CI", { timeout: TEST_TIMEOUT }, async () => {
        const result = await execaCommand(`node ${CLI_PATH} init`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.stderr).toContain("cube");
        expect(result.stderr).toContain("components");
        expect(result.stderr).toContain("generate");
    });
});
