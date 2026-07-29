import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fillDefaults } from "@sugarcube-sh/core";
import type { InternalConfig } from "@sugarcube-sh/core";
import { afterEach, describe, expect, it } from "vitest";
import { createWatchSession } from "../src/watch/regenerate.js";

type Fixture = {
    config: InternalConfig;
    tokenPath: string;
    markupPath: string;
    variablesPath: string;
    utilitiesPath: string;
    cleanup: () => void;
};

function makeFixture(opts: { themed?: boolean } = {}): Fixture {
    const dir = mkdtempSync(join(tmpdir(), "sugarcube-equiv-"));
    const srcDir = join(dir, "src");
    mkdirSync(srcDir, { recursive: true });

    const tokenPath = join(dir, "tokens.json");
    writeFileSync(
        tokenPath,
        JSON.stringify({
            color: {
                $type: "color",
                a: { $value: "#111111" },
                b: { $value: "#222222" },
                c: { $value: "#333333" },
            },
        }),
    );

    const resolutionOrder: unknown[] = [
        { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
    ];
    if (opts.themed) {
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

    const resolverPath = join(dir, "tokens.resolver.json");
    writeFileSync(
        resolverPath,
        JSON.stringify({ version: "2025.10", name: "equiv", resolutionOrder }),
    );

    const markupPath = join(srcDir, "component.html");
    writeFileSync(markupPath, `<div class="text-a">hello</div>\n`);

    const variablesPath = join(dir, "out/tokens.css");
    const utilitiesPath = join(dir, "out/utilities.css");

    const config = fillDefaults({
        resolver: resolverPath,
        content: [join(srcDir, "**/*.html")],
        variables: { path: variablesPath },
        utilities: {
            path: utilitiesPath,
            classes: { color: { source: "color.*", prefix: "text" } },
        },
    });

    return {
        config,
        tokenPath,
        markupPath,
        variablesPath,
        utilitiesPath,
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

const read = (path: string) => readFileSync(path, "utf8");

let fixture: Fixture | null = null;
afterEach(() => {
    fixture?.cleanup();
    fixture = null;
});

describe("watch session incremental == cold build", () => {
    it("markup change produces the same utilities as a cold rebuild", async () => {
        const fx = (fixture = makeFixture());

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const variablesAtPrime = read(fx.variablesPath);

        writeFileSync(fx.markupPath, `<div class="text-a text-b">hello</div>\n`);

        await warm.onChange("markup", fx.markupPath);
        const incrementalUtilities = read(fx.utilitiesPath);
        const variablesAfterMarkup = read(fx.variablesPath);

        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldUtilities = read(fx.utilitiesPath);
        const coldVariables = read(fx.variablesPath);

        expect(incrementalUtilities).toContain("text-b");
        expect(incrementalUtilities).toBe(coldUtilities);
        expect(variablesAfterMarkup).toBe(variablesAtPrime);
        expect(variablesAfterMarkup).toBe(coldVariables);
    });

    it("token change produces the same variables and utilities as a cold rebuild", async () => {
        const fx = (fixture = makeFixture());

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const variablesAtPrime = read(fx.variablesPath);

        writeFileSync(
            fx.tokenPath,
            JSON.stringify({
                color: {
                    $type: "color",
                    a: { $value: "#abcdef" },
                    b: { $value: "#222222" },
                    c: { $value: "#333333" },
                },
            }),
        );

        await warm.onChange("token", fx.tokenPath);
        const incrementalVariables = read(fx.variablesPath);
        const incrementalUtilities = read(fx.utilitiesPath);

        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldVariables = read(fx.variablesPath);
        const coldUtilities = read(fx.utilitiesPath);

        expect(incrementalVariables).not.toBe(variablesAtPrime);
        expect(incrementalVariables).toContain("#abcdef");
        expect(incrementalVariables).toBe(coldVariables);
        expect(incrementalUtilities).toBe(coldUtilities);
    });

    it("markup change leaves a themed (multi-permutation) variables file identical to cold", async () => {
        const fx = (fixture = makeFixture({ themed: true }));

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const variablesAtPrime = read(fx.variablesPath);
        expect(variablesAtPrime).toContain(":root");
        expect(variablesAtPrime).toContain('[data-theme="dark"]');

        writeFileSync(fx.markupPath, `<div class="text-a text-b">hello</div>\n`);
        await warm.onChange("markup", fx.markupPath);
        const incrementalUtilities = read(fx.utilitiesPath);
        const variablesAfterMarkup = read(fx.variablesPath);

        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldUtilities = read(fx.utilitiesPath);
        const coldVariables = read(fx.variablesPath);

        expect(incrementalUtilities).toContain("text-b");
        expect(incrementalUtilities).toBe(coldUtilities);
        expect(variablesAfterMarkup).toBe(variablesAtPrime);
        expect(variablesAfterMarkup).toBe(coldVariables);
    });

    it("adding a token used in markup regenerates utilities (structural change is not skipped)", async () => {
        const fx = (fixture = makeFixture());

        writeFileSync(fx.markupPath, `<div class="text-a text-d">hello</div>\n`);

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const utilitiesAtPrime = read(fx.utilitiesPath);
        expect(utilitiesAtPrime).not.toContain("text-d");

        writeFileSync(
            fx.tokenPath,
            JSON.stringify({
                color: {
                    $type: "color",
                    a: { $value: "#111111" },
                    b: { $value: "#222222" },
                    c: { $value: "#333333" },
                    d: { $value: "#444444" },
                },
            }),
        );

        await warm.onChange("token", fx.tokenPath);
        const incrementalUtilities = read(fx.utilitiesPath);

        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldUtilities = read(fx.utilitiesPath);

        expect(incrementalUtilities).toContain("text-d");
        expect(incrementalUtilities).toBe(coldUtilities);
    });

    it("consecutive markup changes stay identical to a cold rebuild", async () => {
        const fx = (fixture = makeFixture());

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();

        writeFileSync(fx.markupPath, `<div class="text-a text-b">hello</div>\n`);
        await warm.onChange("markup", fx.markupPath);

        writeFileSync(fx.markupPath, `<div class="text-a text-b text-c">hello</div>\n`);
        await warm.onChange("markup", fx.markupPath);
        const incrementalUtilities = read(fx.utilitiesPath);

        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldUtilities = read(fx.utilitiesPath);

        expect(incrementalUtilities).toContain("text-c");
        expect(incrementalUtilities).toBe(coldUtilities);
    });

    it("a markup change that removes a class drops it (reused generator has no stale state)", async () => {
        const fx = (fixture = makeFixture());

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();

        writeFileSync(fx.markupPath, `<div class="text-a text-b">hello</div>\n`);
        await warm.onChange("markup", fx.markupPath);
        expect(read(fx.utilitiesPath)).toContain("text-b");

        writeFileSync(fx.markupPath, `<div class="text-a">hello</div>\n`);
        await warm.onChange("markup", fx.markupPath);
        const incrementalUtilities = read(fx.utilitiesPath);

        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldUtilities = read(fx.utilitiesPath);

        expect(incrementalUtilities).not.toContain("text-b");
        expect(incrementalUtilities).toBe(coldUtilities);
    });
});
