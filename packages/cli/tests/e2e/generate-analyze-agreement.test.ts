import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

/**
 * `analyze unused` claims a token is dead. `generate` decides what actually
 * ships. Those two answers are only meaningful if they agree, and neither
 * command can verify that alone, so this asserts the contract between them directly.
 */
const RESOLVER = JSON.stringify({
    version: "2025.10",
    name: "test",
    resolutionOrder: [
        {
            type: "set",
            name: "base",
            sources: [
                {
                    space: {
                        md: { $type: "dimension", $value: { value: 1, unit: "rem" } },
                        lg: { $type: "dimension", $value: { value: 2, unit: "rem" } },
                        xl: { $type: "dimension", $value: { value: 4, unit: "rem" } },
                    },
                },
            ],
        },
    ],
});

const CONFIG = `
    export default {
        resolver: "./tokens/tokens.resolver.json",
        variables: { path: "./out/variables.gen.css" },
        utilities: {
            path: "./out/utilities.gen.css",
            classes: {
                padding: { source: "space.*", prefix: "p", safelist: ["lg"] },
            },
        },
        content: ["./templates/**/*", "./out/**/*"],
    };
`;

const cssVarFor = (token: string) => `--${token.replace(/\./g, "-")}`;

describe("generate and analyze agree about what is used", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-agreement-${Date.now()}`);
        await mkdir(join(testDir, "tokens"), { recursive: true });
        await mkdir(join(testDir, "templates"), { recursive: true });
        await mkdir(join(testDir, "out"), { recursive: true });

        await createPackageJson(testDir);
        await writeFile(join(testDir, "tokens", "tokens.resolver.json"), RESOLVER);
        await writeFile(join(testDir, "sugarcube.config.js"), CONFIG);
        await writeFile(join(testDir, "templates", "page.heex"), `<div class="p-md"></div>`);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    const run = (args: string) =>
        execaCommand(`node ${CLI_PATH} ${args}`, {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
        });

    it(
        "never reports a token unused while generate still emits a utility for it",
        { timeout: TEST_TIMEOUT },
        async () => {
            await run("generate --force --silent");
            const utilities = await readFile(join(testDir, "out", "utilities.gen.css"), "utf-8");

            const shipped = new Set(
                [...utilities.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]),
            );
            expect(shipped.size).toBeGreaterThan(0);

            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout) as { unused: string[] };

            const contradictions = unused.filter((token) => shipped.has(cssVarFor(token)));
            expect(contradictions).toEqual([]);
        },
    );

    it("still reports a token nothing ships as unused", { timeout: TEST_TIMEOUT }, async () => {
        await run("generate --force --silent");
        const { stdout } = await run("analyze unused --json");
        const { unused } = JSON.parse(stdout) as { unused: string[] };

        expect(unused).toContain("space.xl");
        expect(unused).not.toContain("space.md");
        expect(unused).not.toContain("space.lg");
    });
});
