import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, PLAIN_OUTPUT, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const black = { colorSpace: "srgb", components: [0, 0, 0] };

const RESOLVER = {
    version: "2025.10",
    resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
};

const BASE = { color: { ink: color(black), wrong: color("{color.missing}") } };

describe("lint, when the tokens have errors", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-lint-tokens-${Date.now()}`);
        const tokensDir = join(testDir, "tokens");
        await mkdir(tokensDir, { recursive: true });
        await mkdir(join(testDir, "styles"), { recursive: true });
        await createPackageJson(testDir);
        await writeFile(join(tokensDir, "tokens.resolver.json"), JSON.stringify(RESOLVER));
        await writeFile(join(tokensDir, "base.json"), JSON.stringify(BASE));
        await writeFile(join(testDir, "styles", "app.css"), ".a { color: var(--color-ink); }");
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    const run = (args: string) =>
        execaCommand(`node ${CLI_PATH} ${args}`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
            env: PLAIN_OUTPUT,
        });

    it(
        "shows each error with its place, lints nothing and exits 1",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout, exitCode } = await run("lint");

            expect(stdout).toMatch(/tokens\/base\.json:\d+:\d+\s+error/);
            expect(stdout).toContain("missing-reference");
            expect(stdout).toContain("Nothing was linted.");
            expect(stdout).not.toContain("without fallback");
            expect(exitCode).toBe(1);
        },
    );

    it(
        "keeps stdout empty for --json, with the errors on stderr",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout, stderr, exitCode } = await run("lint --json");

            expect(stdout).toBe("");
            expect(stderr).toContain("missing-reference");
            expect(stderr).toContain("Nothing was linted.");
            expect(exitCode).toBe(1);
        },
    );

    it("says nothing about warnings in the tokens", { timeout: TEST_TIMEOUT }, async () => {
        const warned = { color: { ink: { ...color(black), $figmaId: "123" } } };
        await writeFile(join(testDir, "tokens", "base.json"), JSON.stringify(warned));

        const { stdout, exitCode } = await run("lint");

        expect(stdout).not.toContain("warning");
        expect(stdout).toContain("No undeclared references");
        expect(exitCode).toBe(0);
    });
});
