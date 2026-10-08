import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type LoadedConfig, type UtilityClassesConfig, fillDefaults } from "@sugarcube-sh/core";
import { afterEach, describe, expect, it } from "vitest";
import { type Built, build, rescan } from "../src/build.js";

interface Fixture {
    loaded: LoadedConfig;
    tokens: (spaceMd?: number, extra?: Record<string, unknown>) => void;
    markup: (html: string) => void;
}

interface Options {
    themed?: boolean;
    spacing?: boolean;
    safelist?: boolean;
}

const folders: string[] = [];

afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function project(options: Options = {}): Fixture {
    const folder = mkdtempSync(join(tmpdir(), "sugarcube-watch-equivalence-"));
    folders.push(folder);
    mkdirSync(join(folder, "src"));

    const tokens = (spaceMd = 1, extra: Record<string, unknown> = {}) => {
        const color = { $type: "color", a: { $value: "#111111" }, b: { $value: "#222222" } };
        const space = {
            $type: "dimension",
            sm: { $value: { value: 0.5, unit: "rem" } },
            md: { $value: { value: spaceMd, unit: "rem" } },
        };
        const spaced = options.spacing || options.safelist;
        writeFileSync(
            join(folder, "tokens.json"),
            JSON.stringify({ color: { ...color, ...extra }, ...(spaced && { space }) }),
        );
    };
    const markup = (html: string) => writeFileSync(join(folder, "src/component.html"), html);

    const resolutionOrder: unknown[] = [
        { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
    ];
    if (options.themed) {
        resolutionOrder.push({
            type: "modifier",
            name: "theme",
            default: "light",
            contexts: {
                light: [],
                dark: [{ color: { a: { $type: "color", $value: "#eeeeee" } } }],
            },
        });
    }
    const resolver = join(folder, "tokens.resolver.json");
    writeFileSync(resolver, JSON.stringify({ version: "2025.10", resolutionOrder }));

    const classes: UtilityClassesConfig = { color: { source: "color.*", prefix: "text" } };
    if (options.spacing || options.safelist) {
        classes.padding = { source: "space.*", prefix: "p", safelist: options.safelist };
    }
    const config = fillDefaults({
        resolver,
        content: [join(folder, "src/**/*.html")],
        variables: { path: join(folder, "out/tokens.css") },
        utilities: { path: join(folder, "out/utilities.css"), classes },
    });

    tokens();
    markup(`<div class="text-a">hello</div>\n`);
    return { loaded: { config: { ...config, resolver } }, tokens, markup };
}

const css = ({ variables, utilities }: Built) => ({ variables, utilities });

describe("a save while watching makes what a cold build makes", () => {
    it("a markup save rescans with the last build's generator, the variables unchanged", async () => {
        const fx = project();
        const first = await build(fx.loaded);

        fx.markup(`<div class="text-a text-b">hello</div>\n`);
        const saved = await rescan(first, fx.loaded.config);

        expect(saved.utilities[0]?.css).toContain("text-b");
        expect(saved.variables).toBe(first.variables);
        expect(saved.generator).toBe(first.generator);
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });

    it("a token save makes the variables and utilities a cold build makes", async () => {
        const fx = project({ spacing: true });
        const first = await build(fx.loaded);
        fx.markup(`<div class="text-a p-md">hello</div>\n`);
        const marked = await rescan(first, fx.loaded.config);

        fx.tokens(2);
        const saved = await build(fx.loaded, {}, marked);

        expect(saved.variables[0]?.css).toContain("2rem");
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });

    it("a token save keeps the generator when the classes are the same", async () => {
        const fx = project({ spacing: true });
        const first = await build(fx.loaded);

        fx.tokens(2);
        const saved = await build(fx.loaded, {}, first);

        expect(first.generator).toBeDefined();
        expect(saved.generator).toBe(first.generator);
    });

    it("a token save that adds a class markup uses makes a new generator, and writes the class", async () => {
        const fx = project();
        fx.markup(`<div class="text-a text-c">hello</div>\n`);
        const first = await build(fx.loaded);
        expect(first.utilities[0]?.css).not.toContain("text-c");

        fx.tokens(1, { c: { $value: "#333333" } });
        const saved = await build(fx.loaded, {}, first);

        expect(saved.generator).not.toBe(first.generator);
        expect(saved.utilities[0]?.css).toContain("text-c");
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });

    it("a markup save that drops a class drops its utility", async () => {
        const fx = project();
        fx.markup(`<div class="text-a text-b">hello</div>\n`);
        const first = await build(fx.loaded);

        fx.markup(`<div class="text-a">hello</div>\n`);
        const saved = await rescan(first, fx.loaded.config);

        expect(saved.utilities[0]?.css).not.toContain("text-b");
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });

    it("markup saves one after another stay equal to a cold build", async () => {
        const fx = project();
        let saved = await build(fx.loaded);
        for (const html of ["text-a text-b", "text-b", "text-a"]) {
            fx.markup(`<div class="${html}">hello</div>\n`);
            saved = await rescan(saved, fx.loaded.config);
        }
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });

    it("a markup save leaves a themed variables file as a cold build writes it", async () => {
        const fx = project({ themed: true });
        const first = await build(fx.loaded);

        fx.markup(`<div class="text-a text-b">hello</div>\n`);
        const saved = await rescan(first, fx.loaded.config);

        expect(saved.variables[0]?.css).toContain('[data-theme="dark"]');
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });

    it("a value saved keeps the safelist's utilities as a cold build writes them", async () => {
        const fx = project({ safelist: true });
        const first = await build(fx.loaded);

        fx.tokens(3);
        const saved = await build(fx.loaded, {}, first);

        expect(saved.utilities[0]?.css).toContain("p-md");
        expect(css(saved)).toStrictEqual(css(await build(fx.loaded)));
    });
});
