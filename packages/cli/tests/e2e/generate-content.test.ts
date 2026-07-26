import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson, createTokens } from "./helpers.js";

describe("generate command: content globs", () => {
    let testDir: string;
    let assetsJs: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-content-${Date.now()}`);
        assetsJs = join(testDir, "assets", "js");
        await mkdir(assetsJs, { recursive: true });
        await createPackageJson(assetsJs);
        await createTokens(assetsJs);

        const libDir = join(testDir, "lib", "app_web");
        await mkdir(libDir, { recursive: true });
        await writeFile(join(libDir, "page.heex"), `<div class="text-primary">hi</div>`);

        const config = `
            export default {
                resolver: "./design-tokens/tokens.resolver.json",
                variables: { path: "../css/tokens.css" },
                utilities: {
                    path: "../css/utilities.css",
                    classes: { color: { source: "color.*", prefix: "text" } },
                },
                content: ["../../lib/**/*.heex"],
            };
        `;
        await writeFile(join(assetsJs, "sugarcube.config.js"), config);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it(
        "generates utilities for classes used in templates above the working directory",
        { timeout: TEST_TIMEOUT },
        async () => {
            const result = await execaCommand(`node ${CLI_PATH} generate`, {
                cwd: assetsJs,
                timeout: TEST_TIMEOUT,
                reject: false,
            });

            expect(result.exitCode).toBe(0);

            // Output paths are cwd-relative (cwd = assets/js), so `../css` is assets/css.
            const utilitiesPath = join(testDir, "assets", "css", "utilities.css");
            expect(existsSync(utilitiesPath)).toBe(true);

            const css = await readFile(utilitiesPath, "utf-8");
            expect(css).toContain(".text-primary");
        },
    );
});
