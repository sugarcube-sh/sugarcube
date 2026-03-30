import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

describe("cube command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-cube-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        await createPackageJson(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("writes CUBE files to styles/ when no src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        const result = await execaCommand(`node ${CLI_PATH} cube --force`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "styles/global/global.css"))).toBe(true);
        expect(existsSync(join(testDir, "styles/compositions/flow.css"))).toBe(true);
    });

    it("writes CUBE files to src/styles/ when src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        await mkdir(join(testDir, "src"), { recursive: true });

        const result = await execaCommand(`node ${CLI_PATH} cube --force`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "src/styles/global/global.css"))).toBe(true);
        expect(existsSync(join(testDir, "src/styles/compositions/flow.css"))).toBe(true);
    });

    it("respects --output flag", { timeout: TEST_TIMEOUT }, async () => {
        const result = await execaCommand(`node ${CLI_PATH} cube --force --output custom/css`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "custom/css/global/global.css"))).toBe(true);
    });
});
