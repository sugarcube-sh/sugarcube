import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findUses } from "../src/analyze/uses.js";
import { build } from "../src/build.js";
import { loadConfig } from "../src/config.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const black = { colorSpace: "srgb", components: [0, 0, 0] };
const rem = (value: number) => ({ $type: "dimension", $value: { value, unit: "rem" } });

const RESOLVER = {
    version: "2025.10",
    resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
};

const BASE = {
    color: { brand: color(black), quiet: color(black) },
    space: { md: rem(1), lg: rem(2) },
    text: {
        base: {
            $type: "typography",
            $value: {
                fontFamily: "Inter",
                fontSize: { value: 1, unit: "rem" },
                fontWeight: 400,
                letterSpacing: { value: 0, unit: "rem" },
                lineHeight: 1.5,
            },
        },
    },
};

const CLASSES = `{
    padding: { source: "space.*", prefix: "p" },
    margin: { source: "space.*", prefix: "m", safelist: ["lg"] },
}`;

describe("findUses", () => {
    let dir: string;
    let cwd: string;

    beforeEach(async () => {
        cwd = process.cwd();
        dir = await realpath(await mkdtemp(join(tmpdir(), "sugarcube-uses-")));
        await mkdir(join(dir, "tokens"));
        await mkdir(join(dir, "styles"));
        await writeFile(join(dir, "package.json"), JSON.stringify({ name: "uses" }));
        await writeFile(join(dir, "tokens", "tokens.resolver.json"), JSON.stringify(RESOLVER));
        await writeFile(join(dir, "tokens", "base.json"), JSON.stringify(BASE));
        await writeFile(
            join(dir, "styles", "app.css"),
            [
                ".a { color: var(--color-brand); }",
                ".b { font-family: var(--text-base-font-family); }",
                ".c { border-color: var(--color-brand); }",
                ".d { color: var(--not-a-token); }",
            ].join("\n"),
        );
        await writeFile(
            join(dir, "index.html"),
            [
                '<main class="layout">',
                '  <div class="p-md">',
                "  </div>",
                '  <p class="m-lg p-md"></p>',
                "</main>",
            ].join("\n"),
        );
        process.chdir(dir);
    });

    afterEach(async () => {
        process.chdir(cwd);
        await rm(dir, { recursive: true, force: true });
    });

    const project = async (config: string) => {
        await writeFile(join(dir, "sugarcube.config.js"), `export default ${config};`);
        return build(await loadConfig());
    };

    const withClasses = (extra = "") =>
        project(
            `{ resolver: "./tokens/tokens.resolver.json", ${extra} utilities: { classes: ${CLASSES} } }`,
        );

    it("finds each var() of a token in a stylesheet, with its place", async () => {
        const { uses } = await findUses(await withClasses());

        expect(uses.filter(({ token }) => token === "color.brand")).toStrictEqual([
            {
                token: "color.brand",
                file: join(dir, "styles/app.css"),
                line: 1,
                var: "--color-brand",
            },
            {
                token: "color.brand",
                file: join(dir, "styles/app.css"),
                line: 3,
                var: "--color-brand",
            },
        ]);
    });

    it("finds a typography token through one of its properties' variables", async () => {
        const { uses } = await findUses(await withClasses());

        expect(uses.filter(({ token }) => token === "text.base")).toStrictEqual([
            {
                token: "text.base",
                file: join(dir, "styles/app.css"),
                line: 2,
                var: "--text-base-font-family",
            },
        ]);
    });

    it("leaves out a variable no token declares", async () => {
        const { uses } = await findUses(await withClasses());

        expect(uses.some(({ var: name }) => name === "--not-a-token")).toBe(false);
    });

    it("finds each place a utility class is used in markup", async () => {
        const { uses } = await findUses(await withClasses());

        expect(uses.filter(({ token }) => token === "space.md")).toStrictEqual([
            {
                token: "space.md",
                file: join(dir, "index.html"),
                line: 2,
                var: "--space-md",
                class: "p-md",
            },
            {
                token: "space.md",
                file: join(dir, "index.html"),
                line: 4,
                var: "--space-md",
                class: "p-md",
            },
        ]);
    });

    it("places a safelisted class at the config file, beside its uses in markup", async () => {
        const { uses } = await findUses(await withClasses());

        expect(uses.filter(({ token }) => token === "space.lg")).toStrictEqual([
            {
                token: "space.lg",
                file: join(dir, "index.html"),
                line: 4,
                var: "--space-lg",
                class: "m-lg",
            },
            {
                token: "space.lg",
                file: join(dir, "sugarcube.config.js"),
                var: "--space-lg",
                class: "m-lg",
            },
        ]);
    });

    it("names variables with the config's prefix", async () => {
        await writeFile(join(dir, "styles", "app.css"), ".a { color: var(--ds-color-brand); }");
        const { uses } = await findUses(await withClasses(`variables: { prefix: "ds" },`));

        expect(uses.filter(({ token }) => token === "color.brand")).toStrictEqual([
            {
                token: "color.brand",
                file: join(dir, "styles/app.css"),
                line: 1,
                var: "--ds-color-brand",
            },
        ]);
    });

    it("says what it scanned", async () => {
        const found = await findUses(await withClasses());

        expect(found.scanned).toStrictEqual({
            forVarReferences: [join(dir, "index.html"), join(dir, "styles/app.css")],
            forUtilityClasses: [join(dir, "index.html")],
        });
        expect(found.unread).toStrictEqual([]);
    });

    it("finds markup outside the working folder through content", async () => {
        await mkdir(join(dir, "lib"));
        await writeFile(join(dir, "lib", "page.heex"), '<div class="p-md"></div>');
        await mkdir(join(dir, "assets"));
        process.chdir(join(dir, "assets"));
        await writeFile(
            join(dir, "assets", "sugarcube.config.js"),
            `export default { resolver: "../tokens/tokens.resolver.json", content: ["../lib/**/*"], utilities: { classes: ${CLASSES} } };`,
        );
        const found = await findUses(await build(await loadConfig()));

        expect(found.scanned.forUtilityClasses).toStrictEqual([join(dir, "lib", "page.heex")]);
        expect(found.uses.filter(({ class: name }) => name === "p-md")).toStrictEqual([
            {
                token: "space.md",
                file: join(dir, "lib", "page.heex"),
                line: 1,
                var: "--space-md",
                class: "p-md",
            },
        ]);
    });

    it("finds no class uses when the config makes no classes", async () => {
        const found = await findUses(
            await project(`{ resolver: "./tokens/tokens.resolver.json" }`),
        );

        expect(found.scanned.forUtilityClasses).toStrictEqual([]);
        expect(found.uses.some(({ class: name }) => name !== undefined)).toBe(false);
    });
});
