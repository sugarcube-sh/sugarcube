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
    sets: {
        palette: {
            sources: [{ $ref: "palette.json" }],
            $extensions: { "sh.sugarcube": { emit: false } },
        },
        base: { sources: [{ $ref: "base.json" }] },
    },
    resolutionOrder: [{ $ref: "#/sets/palette" }, { $ref: "#/sets/base" }],
};

const PALETTE = { hidden: { via: color("{color.target}"), lonely: color(black) } };

const BASE = {
    color: {
        "target": color(black),
        "through-private": color("{hidden.via}"),
        "pointed": color(black),
        "pointer": color({ $ref: "#/color/pointed/$value" }),
    },
};

describe("analyze, reading tokens", () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `sugarcube-e2e-analyze-tokens-${Date.now()}`);
        const tokensDir = join(testDir, "tokens");
        await mkdir(tokensDir, { recursive: true });
        await mkdir(join(testDir, "styles"), { recursive: true });
        await createPackageJson(testDir);
        await writeFile(join(tokensDir, "tokens.resolver.json"), JSON.stringify(RESOLVER));
        await writeFile(join(tokensDir, "palette.json"), JSON.stringify(PALETTE));
        await writeFile(join(tokensDir, "base.json"), JSON.stringify(BASE));
        await writeFile(
            join(testDir, "styles", "app.css"),
            ".a { color: var(--color-through-private); background: var(--color-pointer); }",
        );
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
        "follows a chain of references through a private token",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout } = await run("analyze unused --json");
            const { unused } = JSON.parse(stdout);

            expect(unused).not.toContain("color.target");
            expect(unused).not.toContain("hidden.via");
        },
    );

    it(
        "names what refers to a token through a private one",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout } = await run("analyze impact color.target --json");
            const { dependents } = JSON.parse(stdout);

            expect(dependents).toStrictEqual([
                { token: "color.through-private", references: ["hidden.via"] },
                { token: "hidden.via", references: ["color.target"] },
            ]);
        },
    );

    it("lists a private token nothing reaches", { timeout: TEST_TIMEOUT }, async () => {
        const { stdout } = await run("analyze unused --json");
        const { unused, total } = JSON.parse(stdout);

        expect(unused).toStrictEqual(["hidden.lonely"]);
        expect(total).toBe(6);
    });

    it(
        "counts a pointer as using the token it points into",
        { timeout: TEST_TIMEOUT },
        async () => {
            const { stdout } = await run("analyze impact color.pointed --json");
            const { dependents } = JSON.parse(stdout);

            expect(dependents).toStrictEqual([
                { token: "color.pointer", references: ["color.pointed"] },
            ]);
        },
    );

    it("says a group is not a token", { timeout: TEST_TIMEOUT }, async () => {
        const { stdout, stderr, exitCode } = await run("analyze impact hidden");

        expect(`${stdout}${stderr}`).toContain("`hidden` is a group; impact takes one token.");
        expect(exitCode).toBe(1);
    });

    it("says only that a path is no token", { timeout: TEST_TIMEOUT }, async () => {
        const { stdout, stderr, exitCode } = await run("analyze impact target");
        const said = `${stdout}${stderr}`;

        expect(said).toContain('No token "target" in this system.');
        expect(said).not.toMatch(/did you mean/i);
        expect(exitCode).toBe(1);
    });

    describe("when the tokens have errors", () => {
        beforeEach(async () => {
            const broken = { color: { ...BASE.color, wrong: color("{color.missing}") } };
            await writeFile(join(testDir, "tokens", "base.json"), JSON.stringify(broken));
        });

        it(
            "shows each error with its place, analyses nothing and exits 1",
            { timeout: TEST_TIMEOUT },
            async () => {
                const { stdout, exitCode } = await run("analyze unused");

                expect(stdout).toMatch(/tokens\/base\.json:\d+:\d+\s+error/);
                expect(stdout).toContain("missing-reference");
                expect(stdout).toContain("Nothing was analysed.");
                expect(stdout).not.toContain("unused");
                expect(exitCode).toBe(1);
            },
        );

        it(
            "keeps stdout empty for --json, with the errors on stderr",
            { timeout: TEST_TIMEOUT },
            async () => {
                const { stdout, stderr, exitCode } = await run("analyze unused --json");

                expect(stdout).toBe("");
                expect(stderr).toContain("missing-reference");
                expect(stderr).toContain("Nothing was analysed.");
                expect(exitCode).toBe(1);
            },
        );

        it("stops impact the same way", { timeout: TEST_TIMEOUT }, async () => {
            const { stdout, exitCode } = await run("analyze impact color.target");

            expect(stdout).toContain("missing-reference");
            expect(stdout).toContain("Nothing was analysed.");
            expect(exitCode).toBe(1);
        });
    });
});
