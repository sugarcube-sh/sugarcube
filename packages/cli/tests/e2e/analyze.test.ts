import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

const RESOLVER = JSON.stringify({
    version: "2025.10",
    name: "test",
    resolutionOrder: [
        {
            type: "set",
            name: "base",
            sources: [
                {
                    palette: { blue: { "500": { $type: "color", $value: "#007bff" } } },
                    color: {
                        brand: { $type: "color", $value: "{palette.blue.500}" },
                        orphan: { $type: "color", $value: "#ff0000" },
                    },
                    space: { md: { $type: "dimension", $value: { value: 1, unit: "rem" } } },
                },
            ],
        },
    ],
});

const CONFIG = `
    export default {
        resolver: "./design-tokens/tokens.resolver.json",
        variables: { path: "./styles/tokens.gen.css" },
        utilities: { classes: { padding: { source: "space.*", prefix: "p" } } },
    };
`;

describe("analyze command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-analyze-${Date.now()}`);
        const tokensDir = join(testDir, "design-tokens");
        const stylesDir = join(testDir, "styles");
        await mkdir(tokensDir, { recursive: true });
        await mkdir(stylesDir, { recursive: true });

        await createPackageJson(testDir);
        await writeFile(join(tokensDir, "tokens.resolver.json"), RESOLVER);
        await writeFile(join(testDir, "sugarcube.config.js"), CONFIG);
        await writeFile(join(stylesDir, "app.css"), `.btn { color: var(--color-brand); }`);
        await writeFile(join(testDir, "index.html"), `<div class="p-md">hi</div>`);
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
        "does not report a primitive that is only reached through an alias",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout);

            expect(unused).not.toContain("palette.blue.500");
            expect(unused).not.toContain("color.brand");
        },
    );

    it(
        "reports a token nothing references and nothing uses",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout);

            expect(unused).toContain("color.orphan");
        },
    );

    it("names the dependents of a token in `impact`", { timeout: TEST_TIMEOUT }, async () => {
        const { stdout } = await run("analyze impact palette.blue.500 --json");
        const result = JSON.parse(stdout);

        expect(result.token).toBe("palette.blue.500");
        expect(result.dependents).toContainEqual({
            token: "color.brand",
            references: "palette.blue.500",
        });
    });

    it(
        "counts a token reached only through a utility class as used",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout);

            expect(unused).not.toContain("space.md");
        },
    );

    it("takes no path argument to narrow usage with", { timeout: TEST_TIMEOUT }, async () => {
        const { stdout, stderr } = await run(`analyze unused "styles/**/*.css"`);

        expect(`${stdout}${stderr}`).toMatch(/too many arguments/i);
    });

    it(
        "counts a token reached only through a safelisted class as used",
        { timeout: TEST_TIMEOUT },
        async () => {
            await writeFile(
                join(testDir, "sugarcube.config.js"),
                CONFIG.replace(
                    'padding: { source: "space.*", prefix: "p" }',
                    'padding: { source: "space.*", prefix: "p", safelist: true }',
                ),
            );
            await rm(join(testDir, "index.html"));

            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout);

            expect(unused).not.toContain("space.md");
        },
    );

    it(
        "ignores its own generated CSS when deciding what is used",
        { timeout: TEST_TIMEOUT },
        async () => {
            await run("generate --force --silent");
            await writeFile(join(testDir, "index.html"), "<div>no classes</div>");

            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout);

            expect(unused).toContain("space.md");
        },
    );

    it("exits 0 even when tokens are unused", { timeout: TEST_TIMEOUT }, async () => {
        const { exitCode } = await run("analyze unused");

        expect(exitCode).toBe(0);
    });
});
