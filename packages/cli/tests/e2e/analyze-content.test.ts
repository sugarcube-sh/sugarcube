import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson, createTokens } from "./helpers.js";

describe("analyze command: content globs", () => {
    let testDir: string;
    let assetsJs: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-analyze-content-${Date.now()}`);
        assetsJs = join(testDir, "assets", "js");
        await mkdir(assetsJs, { recursive: true });
        await createPackageJson(assetsJs);
        await createTokens(assetsJs);

        const cssDir = join(testDir, "assets", "css");
        await mkdir(cssDir, { recursive: true });
        await writeFile(join(cssDir, "app.css"), `.card { color: var(--color-primary); }`);

        const libDir = join(testDir, "lib", "app_web");
        await mkdir(libDir, { recursive: true });
        await writeFile(join(libDir, "page.heex"), `<div class="card">hi</div>`);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    const writeConfig = async (content: string) => {
        await writeFile(
            join(assetsJs, "sugarcube.config.js"),
            `export default {
                resolver: "./design-tokens/tokens.resolver.json",
                variables: { path: "../css/tokens.css" },
                utilities: { path: "../css/utilities.css" },
                content: [${content}],
            };`,
        );
    };

    const run = (args: string) =>
        execaCommand(`node ${CLI_PATH} ${args}`, {
            cwd: assetsJs,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

    it(
        "warns instead of quietly reporting a used token as unused",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex"`);

            const result = await run("analyze unused");

            expect(result.stdout).toContain("No stylesheets found");
        },
    );

    it(
        "keeps --json parseable and puts the warning on stderr",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex"`);

            const result = await run("analyze unused --json");

            expect(() => JSON.parse(result.stdout)).not.toThrow();
            expect(JSON.parse(result.stdout).scanned.forVarReferences).toBe(0);
            expect(result.stderr).toContain("No stylesheets found");
        },
    );

    it(
        "keeps --all pipeable and puts the warning on stderr",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex"`);

            const result = await run("analyze unused --all");

            expect(result.stdout.trim()).toBe("color.primary");
            expect(result.stderr).toContain("No stylesheets found");
        },
    );

    it(
        "finds the token, and stays quiet, once content reaches the CSS",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex", "../css/**/*.css"`);

            const result = await run("analyze unused");

            expect(result.stdout).toContain("No unused tokens");
            expect(result.stdout).not.toContain("No stylesheets found");
        },
    );

    it("warns on impact as well", { timeout: TEST_TIMEOUT }, async () => {
        await writeConfig(`"../../lib/**/*.heex"`);

        const result = await run("analyze impact color.primary");

        expect(result.stdout).toContain("No stylesheets found");
    });
});
