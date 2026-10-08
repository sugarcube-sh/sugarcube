import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, PLAIN_OUTPUT, TEST_TIMEOUT, createPackageJson } from "./helpers.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const black = { colorSpace: "srgb", components: [0, 0, 0] };

describe("validate command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-validate-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        await createPackageJson(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    async function write(files: Record<string, unknown>) {
        for (const [path, content] of Object.entries(files)) {
            const full = join(testDir, path);
            await mkdir(dirname(full), { recursive: true });
            const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
            await writeFile(full, text);
        }
    }

    const oneSet = (...sources: string[]) => ({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: sources.map(($ref) => ({ $ref })) },
        ],
    });

    function validate(args = "") {
        return execaCommand(`node ${CLI_PATH} validate ${args}`.trim(), {
            cwd: testDir,
            timeout: TEST_TIMEOUT,
            reject: false,
            env: PLAIN_OUTPUT,
        });
    }

    it(
        "with no paths, finds the tokens as generate does and says they are valid",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await write({
                "tokens/tokens.resolver.json": oneSet("base.json"),
                "tokens/base.json": { ink: color(black) },
            });

            const result = await validate();

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("All tokens valid ✨");
        },
    );

    it(
        "with no paths, lists each problem, counts them and exits 1",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await write({
                "tokens/tokens.resolver.json": oneSet("base.json"),
                "tokens/base.json": { ink: color(black), text: color("{inc}") },
            });

            const result = await validate();

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain(
                "tokens/base.json:15:15  error  `inc` does not exist; did you mean `ink`?  missing-reference",
            );
            expect(result.stdout).toContain("1 error.");
            expect(result.stdout).not.toContain("All tokens valid");
        },
    );

    it(
        "with warnings only, counts them and still says the tokens are valid",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await write({
                "tokens/tokens.resolver.json": oneSet("base.json"),
                "tokens/base.json": { ink: { ...color(black), $description: 5 } },
            });

            const result = await validate();

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("1 warning.");
            expect(result.stdout).toContain("All tokens valid ✨");
        },
    );

    it(
        "shows a mistake in the config as the config's, not as a crash",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await write({
                "sugarcube.config.ts": "export default { variables: { prefix: 5 } };",
                "tokens/tokens.resolver.json": oneSet("base.json"),
                "tokens/base.json": { ink: color(black) },
            });

            const result = await validate();

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain("variables.prefix");
            expect(result.stdout).not.toContain("unexpected error");
        },
    );

    it(
        "reads a folder with a resolver in it through the resolver, so themes stay apart",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await write({
                "tokens/tokens.resolver.json": {
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                        {
                            type: "modifier",
                            name: "theme",
                            default: "light",
                            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                        },
                    ],
                },
                "tokens/base.json": { ink: color(black) },
                "tokens/dark.json": { paper: color("{missing}") },
            });

            const result = await validate("tokens");

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain("in dark  missing-reference");
        },
    );

    it(
        "given a resolver, uses the project's config as generate does",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await write({
                "sugarcube.config.ts":
                    'export default { variables: { transforms: { colorFallbackStrategy: "polyfill" } } };',
                "tokens/tokens.resolver.json": oneSet("base.json"),
                "tokens/base.json": { ink: color(black) },
            });

            const result = await validate("tokens/tokens.resolver.json");

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("sugarcube.config.ts  warning");
            expect(result.stdout).toContain("option-deprecated");
        },
    );

    it("names the resolvers when a folder has several", { timeout: TEST_TIMEOUT }, async () => {
        await write({
            "tokens/a.resolver.json": oneSet("base.json"),
            "tokens/b.resolver.json": oneSet("base.json"),
            "tokens/base.json": { ink: color(black) },
        });

        const result = await validate("tokens");

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("Several resolver files were found:");
        expect(result.stdout).toContain("- tokens/a.resolver.json");
        expect(result.stdout).toContain("- tokens/b.resolver.json");
        expect(result.stdout).toContain("sugarcube validate tokens/a.resolver.json");
    });

    it("reads a folder of loose token files as one set", { timeout: TEST_TIMEOUT }, async () => {
        await write({
            "tokens/a.json": { ink: color(black) },
            "tokens/b.json": { text: color("{ink}") },
        });

        const result = await validate("tokens");

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("All tokens valid ✨");
    });
});
