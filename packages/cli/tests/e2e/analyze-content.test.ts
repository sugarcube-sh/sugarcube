import { realpathSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "../../src/constants/error-messages.js";
import { strip } from "../../src/prompts/common.js";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson, createTokens } from "./helpers.js";

const squash = (text: string) =>
    strip(text)
        .replaceAll(/[│┌┐└┘─▲]/gu, "")
        .replaceAll(/\s+/gu, "");

const hasMessage = (output: string, message: string) => squash(output).includes(squash(message));

describe("analyze command: content globs", () => {
    let testDir: string;
    let assetsJs: string;

    beforeEach(async () => {
        // realpath, because the messages embed process.cwd() and macOS reports a spawned
        // process's cwd as /private/var/... where tmpdir() says /var/...
        testDir = join(realpathSync(tmpdir()), `sugarcube-e2e-analyze-content-${Date.now()}`);
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

    const emptyScan = () => ERROR_MESSAGES.ANALYZE_UNUSED_NO_FILES_SCANNED(assetsJs);

    const analyzeUnread = () =>
        ERROR_MESSAGES.ANALYZE_UNREAD_STYLESHEETS([{ dir: "../css", count: 1 }]);
    const lintUnread = () => ERROR_MESSAGES.LINT_UNREAD_STYLESHEETS([{ dir: "../css", count: 1 }]);

    it(
        "warns instead of quietly reporting a used token as unused",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex"`);

            const result = await run("analyze unused");

            expect(hasMessage(result.stdout, emptyScan())).toBe(true);
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
            expect(hasMessage(result.stderr, emptyScan())).toBe(true);
        },
    );

    it(
        "keeps --all pipeable and puts the warning on stderr",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex"`);

            const result = await run("analyze unused --all");

            expect(result.stdout.trim()).toBe("color.primary");
            expect(hasMessage(result.stderr, emptyScan())).toBe(true);
        },
    );

    it(
        "finds the token, and stays quiet, once content reaches the CSS",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeConfig(`"../../lib/**/*.heex", "../css/**/*.css"`);

            const result = await run("analyze unused");

            expect(result.stdout).toContain("No unused tokens");
            expect(hasMessage(result.stdout, emptyScan())).toBe(false);
        },
    );

    it("warns on impact as well", { timeout: TEST_TIMEOUT }, async () => {
        await writeConfig(`"../../lib/**/*.heex"`);

        const result = await run("analyze impact color.primary");

        expect(
            hasMessage(result.stdout, ERROR_MESSAGES.ANALYZE_IMPACT_NO_FILES_SCANNED(assetsJs)),
        ).toBe(true);
    });

    describe("when the scan finds some files but misses the CSS directory", () => {
        beforeEach(async () => {
            await writeFile(join(assetsJs, "local.css"), `.l { color: var(--nope); }`);
        });

        it("warns that CSS went unread", { timeout: TEST_TIMEOUT }, async () => {
            await writeConfig(`"../../lib/**/*.heex"`);

            const result = await run("analyze unused");

            expect(hasMessage(result.stdout, emptyScan())).toBe(false);
            expect(hasMessage(result.stdout, analyzeUnread())).toBe(true);
        });

        it(
            "still lists color.primary as unused, but says why",
            { timeout: TEST_TIMEOUT },
            async () => {
                await writeConfig(`"../../lib/**/*.heex"`);

                const result = await run("analyze unused");

                expect(result.stdout).toContain("primary");
                expect(hasMessage(result.stdout, analyzeUnread())).toBe(true);
            },
        );

        it("stays quiet once content reaches the CSS", { timeout: TEST_TIMEOUT }, async () => {
            await writeConfig(`"../../lib/**/*.heex", "../css/**/*.css"`);

            const result = await run("analyze unused");

            expect(hasMessage(result.stdout, analyzeUnread())).toBe(false);
        });

        it(
            "warns on lint too, without claiming a clean pass",
            { timeout: TEST_TIMEOUT },
            async () => {
                await writeConfig(`"../../lib/**/*.heex"`);

                const result = await run("lint");

                expect(hasMessage(result.stdout, lintUnread())).toBe(true);
            },
        );

        it(
            "stays quiet on lint when given an explicit path",
            { timeout: TEST_TIMEOUT },
            async () => {
                await writeConfig(`"../../lib/**/*.heex"`);

                const result = await run("lint ../css");

                expect(hasMessage(result.stdout, lintUnread())).toBe(false);
            },
        );
    });
});
