import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaCommand } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLI_PATH, TEST_TIMEOUT, createPackageJson, createTokens } from "./helpers.js";

describe("generate command", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-generate-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        await createPackageJson(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    async function tokensWith(base: unknown): Promise<string> {
        const dir = join(testDir, "tokens");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "base.json"), JSON.stringify(base, null, 2));
        await writeFile(
            join(dir, "tokens.resolver.json"),
            JSON.stringify({
                version: "2025.10",
                resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
            }),
        );
        return join(dir, "tokens.resolver.json");
    }

    it(
        "with errors, lists each at its file, line and column, writes nothing and exits 1",
        { timeout: TEST_TIMEOUT },
        async () => {
            const resolver = await tokensWith({
                color: {
                    $type: "color",
                    ink: { $value: "#000000" },
                    text: { $value: "{color.inc}" },
                },
            });

            const result = await execaCommand(`node ${CLI_PATH} generate --resolver ${resolver}`, {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain(
                "tokens/base.json:8:17  error  `color.inc` does not exist; did you mean `color.ink`?  missing-reference",
            );
            expect(result.stdout).toContain("1 error. No CSS was written.");
            expect(existsSync(join(testDir, "styles"))).toBe(false);
        },
    );

    it(
        "with warnings only, lists and counts them, then writes the CSS",
        { timeout: TEST_TIMEOUT },
        async () => {
            const px = (value: number) => ({ value, unit: "px" });
            const resolver = await tokensWith({
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: "Inter",
                        fontSize: px(16),
                        fontWeight: 400,
                        letterSpacing: px(0),
                        lineHeight: 1.5,
                        paragraphSpacing: px(0),
                    },
                },
            });

            const result = await execaCommand(`node ${CLI_PATH} generate --resolver ${resolver}`, {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("warning  `paragraphSpacing` is not a property");
            expect(result.stdout).toContain("1 warning.");
            expect(existsSync(join(testDir, "styles/variables.gen.css"))).toBe(true);
        },
    );

    it(
        "shows a mistake in the config as the config's, not as a crash",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            await createTokens(testDir);
            await writeFile(
                join(testDir, "sugarcube.config.ts"),
                "export default { variables: { prefix: 5 } };",
            );

            const result = await execaCommand(`node ${CLI_PATH} generate`, {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain("variables.prefix");
            expect(result.stdout).not.toContain("unexpected error");
        },
    );

    it(
        "reads the resolver --resolver names, though the config names none and there are several",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            const tokensDir = await createTokens(testDir);
            const resolver = await readFile(join(tokensDir, "tokens.resolver.json"), "utf-8");
            await writeFile(join(tokensDir, "other.resolver.json"), resolver);
            await writeFile(join(testDir, "sugarcube.config.ts"), "export default {};");

            const result = await execaCommand(
                `node ${CLI_PATH} generate --resolver design-tokens/tokens.resolver.json`,
                { cwd: testDir, timeout: TEST_TIMEOUT, reject: false },
            );

            expect(result.exitCode).toBe(0);
            expect(existsSync(join(testDir, "styles/variables.gen.css"))).toBe(true);
        },
    );

    it(
        "says no tokens were found with no config and no resolver, whatever the flags",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            const result = await execaCommand(`node ${CLI_PATH} generate --prefix ds`, {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain("No design tokens found.");
        },
    );

    it("writes to styles/ when no src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        const tokensDir = await createTokens(testDir);

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            },
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "styles/variables.gen.css"))).toBe(true);
        expect(existsSync(join(testDir, "src/styles"))).toBe(false);
    });

    it("writes to src/styles/ when src/ exists", { timeout: TEST_TIMEOUT }, async () => {
        await mkdir(join(testDir, "src"), { recursive: true });
        const tokensDir = await createTokens(join(testDir, "src"));

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            },
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "src/styles/variables.gen.css"))).toBe(true);
    });

    it("respects --variables flag", { timeout: TEST_TIMEOUT }, async () => {
        const tokensDir = await createTokens(testDir);

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json --variables custom/css/tokens.css`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            },
        );

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(testDir, "custom/css/tokens.css"))).toBe(true);
    });

    it(
        "writes the --input permutation in place of the config's, saying nothing",
        {
            timeout: TEST_TIMEOUT,
        },
        async () => {
            const resolver = await tokensWith({ ink: { $type: "color", $value: "#000000" } });
            await writeFile(
                resolver,
                JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                        {
                            type: "modifier",
                            name: "theme",
                            default: "light",
                            contexts: { light: [], dark: [] },
                        },
                    ],
                }),
            );
            await writeFile(
                join(testDir, "sugarcube.config.ts"),
                `export default { variables: { permutations: [{ input: {}, selector: ".from-config" }] } };`,
            );

            const result = await execaCommand(
                `node ${CLI_PATH} generate --resolver ${resolver} --input theme=dark --selector .dark`,
                { cwd: testDir, timeout: TEST_TIMEOUT, reject: false },
            );

            expect(result.exitCode).toBe(0);
            expect(result.stdout).not.toContain("Config permutations ignored");
            const css = await readFile(join(testDir, "styles/variables.gen.css"), "utf-8");
            expect(css).toContain(".dark {");
            expect(css).not.toContain(".from-config");
        },
    );

    it("respects --prefix flag", { timeout: TEST_TIMEOUT }, async () => {
        const tokensDir = await createTokens(testDir);

        const result = await execaCommand(
            `node ${CLI_PATH} generate --resolver ${tokensDir}/tokens.resolver.json --prefix ds`,
            {
                cwd: testDir,
                timeout: TEST_TIMEOUT,
                reject: false,
            },
        );

        expect(result.exitCode).toBe(0);
        const css = await readFile(join(testDir, "styles/variables.gen.css"), "utf-8");
        const declared = [...css.matchAll(/^[ \t]*(--[\w-]+):/gm)].map((m) => m[1]);
        expect(declared.length).toBeGreaterThan(0);
        for (const name of declared) {
            expect(name).toMatch(/^--ds-/);
        }
    });
});
