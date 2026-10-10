import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, PLAIN_OUTPUT, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

const rem = (value: number) => ({ $type: "dimension", $value: { value, unit: "rem" } });

const RESOLVER = {
    version: "2025.10",
    resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
};

const BASE = { space: { sm: rem(0.5), md: rem(1) } };

describe("lint, with utility classes that set variables", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-lint-utilities-${Date.now()}`);
        const tokensDir = join(testDir, "tokens");
        await mkdir(tokensDir, { recursive: true });
        await mkdir(join(testDir, "styles"), { recursive: true });
        await createPackageJson(testDir);
        await writeFile(join(tokensDir, "tokens.resolver.json"), JSON.stringify(RESOLVER));
        await writeFile(join(tokensDir, "base.json"), JSON.stringify(BASE));
        await writeFile(
            join(testDir, "sugarcube.config.js"),
            `export default {
                resolver: "./tokens/tokens.resolver.json",
                utilities: {
                    classes: {
                        "--gutter": { source: "space.*", prefix: "gutter" },
                        "--nothing": { source: "color.*", prefix: "nothing" },
                    },
                },
            };`,
        );
        await writeFile(
            join(testDir, "styles", "app.css"),
            [
                ".a { margin: var(--gutter); }",
                ".b { margin: var(--nothing); }",
                ".c { margin: var(--not-set); }",
            ].join("\n"),
        );
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    const reported = async () => {
        const { stdout } = await execaCommand(`node ${CLI_PATH} lint --json`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
            env: PLAIN_OUTPUT,
        });
        const { noFallback } = JSON.parse(stdout) as { noFallback: { name: string }[] };
        return noFallback.map(({ name }) => name);
    };

    it(
        "counts a variable a utility class sets as declared, with no markup using it",
        { timeout: TEST_TIMEOUT },
        async () => {
            expect(await reported()).not.toContain("--gutter");
        },
    );

    it(
        "still reports a variable whose utility entry makes no classes",
        { timeout: TEST_TIMEOUT },
        async () => {
            expect(await reported()).toContain("--nothing");
        },
    );

    it("still reports a variable nothing sets", { timeout: TEST_TIMEOUT }, async () => {
        expect(await reported()).toContain("--not-set");
    });
});
