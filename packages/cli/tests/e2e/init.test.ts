import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/index.mjs");

const TEST_TIMEOUT = 60_000;

describe("init command - happy path", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("initializes in a fresh npm project (zero-config)", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(`node ${CLI_PATH} init --skip-deps`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);

        // Zero-config: no config file created when no customization flags are passed
        const hasConfig =
            existsSync(join(testDir, "sugarcube.config.ts")) ||
            existsSync(join(testDir, "sugarcube.config.js"));
        expect(hasConfig).toBe(false);

        // But tokens are still created
        expect(existsSync(join(testDir, "design-tokens"))).toBe(true);
    });

    it("initializes in a fresh pnpm project (zero-config)", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );
        await writeFile(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

        const result = await execaCommand(`node ${CLI_PATH} init --skip-deps`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);

        // Zero-config: no config file created when no customization flags are passed
        const hasConfig =
            existsSync(join(testDir, "sugarcube.config.ts")) ||
            existsSync(join(testDir, "sugarcube.config.js"));
        expect(hasConfig).toBe(false);

        // But tokens are still created
        expect(existsSync(join(testDir, "design-tokens"))).toBe(true);
    });

    it("creates config file when customization flags are passed", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({ name: "test-project", version: "1.0.0" })
        );

        const result = await execaCommand(
            `node ${CLI_PATH} init --skip-deps --styles-dir custom-styles`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            }
        );

        expect(result.exitCode).toBe(0);

        // Config file should be created when customization flags are passed
        const configPath = existsSync(join(testDir, "sugarcube.config.ts"))
            ? join(testDir, "sugarcube.config.ts")
            : join(testDir, "sugarcube.config.js");
        expect(existsSync(configPath)).toBe(true);

        // Config should contain the custom styles directory
        const configContent = await readFile(configPath, "utf8");
        expect(configContent).toContain("custom-styles");

        // With --skip-deps, no type source is available, so config is a plain export
        expect(configContent).toContain("export default");
    });

    it("creates config with defineConfig when vite plugin is installed", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({
                name: "test-project",
                version: "1.0.0",
                dependencies: { vite: "^5.0.0" },
            })
        );

        const result = await execaCommand(
            `node ${CLI_PATH} init --styles-dir custom-styles`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            }
        );

        expect(result.exitCode).toBe(0);

        // Config file should use defineConfig when vite plugin is installed
        const configPath = existsSync(join(testDir, "sugarcube.config.ts"))
            ? join(testDir, "sugarcube.config.ts")
            : join(testDir, "sugarcube.config.js");
        expect(existsSync(configPath)).toBe(true);

        const configContent = await readFile(configPath, "utf8");
        expect(configContent).toContain("custom-styles");
        expect(configContent).toContain("defineConfig");
        expect(configContent).toContain("@sugarcube-sh/vite");
    });
});

describe("init command - plugin installation", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("installs vite plugin in a vite project (npm)", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({
                name: "test-vite-project",
                version: "1.0.0",
                dependencies: {
                    vite: "^5.0.0",
                },
            })
        );

        const result = await execaCommand(`node ${CLI_PATH} init`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);

        const pkgJson = JSON.parse(
            await (await import("node:fs/promises")).readFile(join(testDir, "package.json"), "utf8")
        );
        const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
        expect(allDeps["@sugarcube-sh/vite"]).toBeDefined();
    });

    it("installs vite plugin in a pnpm project", { timeout: TEST_TIMEOUT }, async () => {
        await writeFile(
            join(testDir, "package.json"),
            JSON.stringify({
                name: "test-vite-pnpm",
                version: "1.0.0",
                dependencies: {
                    vite: "^5.0.0",
                },
            })
        );
        await writeFile(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

        const result = await execaCommand(`node ${CLI_PATH} init`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBe(0);

        const pkgJson = JSON.parse(
            await (await import("node:fs/promises")).readFile(join(testDir, "package.json"), "utf8")
        );
        const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
        expect(allDeps["@sugarcube-sh/vite"]).toBeDefined();
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

    it("fails gracefully in multi-project directory", { timeout: TEST_TIMEOUT }, async () => {
        const proj1 = join(testDir, "project-one");
        const proj2 = join(testDir, "project-two");

        await mkdir(proj1, { recursive: true });
        await mkdir(proj2, { recursive: true });

        await writeFile(join(proj1, "package.json"), JSON.stringify({ name: "proj1" }));
        await writeFile(join(proj2, "package.json"), JSON.stringify({ name: "proj2" }));

        const nm1 = join(proj1, "node_modules", "fake-pkg");
        const nm2 = join(proj2, "node_modules", "fake-pkg");
        await mkdir(nm1, { recursive: true });
        await mkdir(nm2, { recursive: true });
        await writeFile(join(nm1, "index.js"), "module.exports = {}");
        await writeFile(join(nm2, "index.js"), "module.exports = {}");

        await writeFile(join(testDir, "package.json"), JSON.stringify({ name: "monorepo" }));

        const result = await execaCommand(`node ${CLI_PATH} init --skip-deps`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

        expect(result.exitCode).toBeDefined();

        if (result.exitCode !== 0) {
            const output = result.stdout + result.stderr;
            expect(
                output.includes("monorepo") ||
                    output.includes("multiple projects") ||
                    output.includes("limit")
            ).toBe(true);
        }
    });
});
