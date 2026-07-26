import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson, createTokens } from "./helpers.js";

describe("lint command: content globs", () => {
    let testDir: string;
    let assetsJs: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-lint-content-${Date.now()}`);
        assetsJs = join(testDir, "assets", "js");
        await mkdir(assetsJs, { recursive: true });
        await createPackageJson(assetsJs);
        await createTokens(assetsJs);

        const cssDir = join(testDir, "assets", "css");
        await mkdir(cssDir, { recursive: true });
        await writeFile(join(cssDir, "app.css"), `.x { color: var(--not-a-token); }`);

        const config = `
            export default {
                resolver: "./design-tokens/tokens.resolver.json",
                variables: { path: "../css/tokens.css" },
                content: ["../css/**/*.css"],
            };
        `;
        await writeFile(join(assetsJs, "sugarcube.config.js"), config);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it(
        "scans CSS reached via content and reports undeclared var() refs",
        { timeout: TEST_TIMEOUT },
        async () => {
            const result = await execaCommand(`node ${CLI_PATH} lint --json`, {
                cwd: assetsJs,
                timeout: TEST_TIMEOUT,
                reject: false,
            });

            expect(result.stdout).toContain("--not-a-token");
        },
    );
});
