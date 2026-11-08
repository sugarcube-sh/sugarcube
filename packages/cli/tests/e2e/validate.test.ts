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
                "tokens/base.json": { "ink ": color(black) },
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
            expect(result.stdout).toContain("in theme: dark  missing-reference");
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

    it(
        "finds the resolver among the paths it is given by what is inside it, whatever its name",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({
                "tokens/resolver.json": oneSet("base.json", "brand.json"),
                "tokens/base.json": { ink: color(black) },
                "tokens/brand.json": { text: color("{ink}") },
            });

            for (const paths of ["tokens", "tokens/resolver.json tokens/base.json"]) {
                const result = await validate(paths);

                expect(result.exitCode).toBe(0);
                expect(result.stdout).toContain("All tokens valid ✨");
            }
        },
    );

    it("validates a single token file without a resolver", { timeout: TEST_TIMEOUT }, async () => {
        await write({ "tokens/a.json": { ink: color(black), text: color("{ink}") } });

        const result = await validate("tokens/a.json");

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("All tokens valid ✨");
    });

    it(
        "places a single token file's problem at its path from the working folder",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({ "tokens/a.json": { ink: color(black), text: color("{inc}") } });

            const result = await validate("tokens/a.json");

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toMatch(/^tokens\/a\.json:\d+:\d+  error  `inc` does not exist/m);
        },
    );

    it(
        "finds the one token file in a project folder with no resolver, past its other JSON files",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({
                "tsconfig.json": { compilerOptions: {} },
                "node_modules/kit/tokens.json": { ink: color(black) },
                ".cache/tokens.json": { ink: color(black) },
                "tokens/colors.json": { ink: color(black), text: color("{inc}") },
            });

            const result = await validate(".");

            expect(result.exitCode).toBe(1);
            expect(result.stdout).not.toContain("Several token files");
            expect(result.stdout).toMatch(
                /^tokens\/colors\.json:\d+:\d+  error  `inc` does not exist/m,
            );
        },
    );

    it(
        "checks a .tokens file, named or in a folder, as the spec recommends the extension",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({
                "tokens/brand.tokens": { ink: color(black), text: color("{inc}") },
            });

            for (const path of ["tokens/brand.tokens", "tokens"]) {
                const result = await validate(path);

                expect(result.exitCode).toBe(1);
                expect(result.stdout).toMatch(
                    /^tokens\/brand\.tokens:\d+:\d+  error  `inc` does not exist/m,
                );
            }
        },
    );

    it(
        "checks a folder whose only file is a scale recipe, with no $value in it",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({
                "tokens/space.json": {
                    space: {
                        $type: "dimension",
                        $extensions: {
                            "sh.sugarcube": {
                                scale: {
                                    mode: "multipliers",
                                    base: {
                                        min: { value: 0.875, unit: "rem" },
                                        max: { value: 1, unit: "rem" },
                                    },
                                    multipliers: { sm: 1, md: 1.5 },
                                },
                            },
                        },
                    },
                },
            });

            const result = await validate("tokens");

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("All tokens valid ✨");
        },
    );

    it(
        "names the JSON files it passed over when none holds tokens",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({
                "tsconfig.json": { compilerOptions: {} },
                "tokens/colors.json": { color: { ink: { value: "#000000" } } },
            });

            const result = await validate(".");

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain("No token files found.");
            expect(result.stdout).toContain("- package.json");
            expect(result.stdout).toContain("- tokens/colors.json");
            expect(result.stdout).toContain("- tsconfig.json");
        },
    );

    it(
        "refuses several token files with no resolver, naming them",
        { timeout: TEST_TIMEOUT },
        async () => {
            await write({
                "tokens/a.json": { ink: color(black) },
                "tokens/b.json": { text: color("{ink}") },
            });

            for (const paths of ["tokens", "tokens/a.json tokens/b.json"]) {
                const result = await validate(paths);

                expect(result.exitCode).toBe(1);
                expect(result.stdout).toContain(
                    "Several token files need a resolver to be read together:",
                );
                expect(result.stdout).toContain("- tokens/a.json");
                expect(result.stdout).toContain("- tokens/b.json");
                expect(result.stdout).toContain("https://sugarcube.sh/docs/resolver");
            }
        },
    );
});
