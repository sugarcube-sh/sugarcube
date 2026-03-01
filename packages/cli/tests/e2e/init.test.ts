import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/index.mjs");

const TEST_TIMEOUT = 60_000;

describe("init command - starter kit selection", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("initializes with fluid starter kit via flag", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init --kit fluid`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "design-tokens"))).toBe(true);
    });

    it("initializes with static starter kit via flag", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init --kit static`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "design-tokens"))).toBe(true);
    });

    it("uses src/design-tokens when src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );
        await mkdir(join(testDir, "src"), { recursive: true });

        const result = await execaCommand(`node ${CLI_PATH} init --kit fluid`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "src/design-tokens"))).toBe(true);
    });

    it("respects custom --tokens-dir", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(
            `node ${CLI_PATH} init --kit fluid --tokens-dir custom-tokens`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            }
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "custom-tokens"))).toBe(true);
    });
});

describe("init command - existing tokens", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("detects existing tokens and skips starter kit", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const tokensDir = join(testDir, "design-tokens");
        await mkdir(tokensDir, { recursive: true });

        await writeFile(
            join(tokensDir, "colors.json"),
            JSON.stringify({
                color: {
                    primary: { $value: "#000", $type: "color" },
                },
            })
        );

        await writeFile(
            join(tokensDir, "tokens.resolver.json"),
            JSON.stringify({
                $schema: "https://sugarcube.sh/resolver.schema.json",
                resolutionOrder: ["./colors.json"],
            })
        );

        const result = await execaCommand(`node ${CLI_PATH} init`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
    });
});

describe("init command - CUBE CSS", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("installs CUBE CSS with --cube flag", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init --kit fluid --cube`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "design-tokens"))).toBe(true);
        expect(existsSync(join(testDir, "src/styles"))).toBe(true);
    });

    it("skips CUBE CSS in non-TTY without --cube", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init --kit fluid`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "src/styles"))).toBe(false);
    });
});

describe("init command - edge cases", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("fails if config already exists", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );
        await writeFile(join(testDir, "sugarcube.config.ts"), "export default {};");

        const result = await execaCommand(`node ${CLI_PATH} init --kit fluid`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).not.toBe(0);
    });

    it("zero-config: no config file created", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init --kit fluid`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "design-tokens"))).toBe(true);

        const hasConfig =
            existsSync(join(testDir, "sugarcube.config.ts")) ||
            existsSync(join(testDir, "sugarcube.config.js"));
        expect(hasConfig).toBe(false);
    });
});
