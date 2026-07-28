import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fillDefaults } from "@sugarcube-sh/core";
import type { InternalConfig } from "@sugarcube-sh/core";
import { afterEach, describe, expect, it } from "vitest";
import { createWatchSession } from "../src/watch/regenerate.js";

// The gate for Tier 1 routing: an incremental regeneration (onChange, which
// reuses cached token state) must produce byte-identical CSS to a fresh cold
// build (a new session priming from scratch) for the same on-disk state.

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

    // A themed fixture adds a `theme` modifier, so the variables output has
    // multiple selector blocks (:root + [data-theme="dark"]). A markup change
    // must leave that whole multi-block file untouched and still match cold.
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

        // Prime on the initial state (markup uses only text-a).
        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const variablesAtPrime = read(fx.variablesPath);

        // Edit markup: introduce a new utility class (text-b).
        writeFileSync(fx.markupPath, `<div class="text-a text-b">hello</div>\n`);

        // Incremental markup regeneration reuses cached tokens.
        await warm.onChange("markup", fx.markupPath);
        const incrementalUtilities = read(fx.utilitiesPath);
        const variablesAfterMarkup = read(fx.variablesPath);

        // Cold rebuild from scratch on the edited state.
        await createWatchSession(fx.config, {}).primeAndBuild();
        const coldUtilities = read(fx.utilitiesPath);
        const coldVariables = read(fx.variablesPath);

        // The edit actually changed utilities (guards against a vacuous match).
        expect(incrementalUtilities).toContain("text-b");
        // Incremental utilities match a cold build byte-for-byte.
        expect(incrementalUtilities).toBe(coldUtilities);
        // A markup change must not rewrite variables, and leaving them matches cold.
        expect(variablesAfterMarkup).toBe(variablesAtPrime);
        expect(variablesAfterMarkup).toBe(coldVariables);
    });

    it("token change produces the same variables and utilities as a cold rebuild", async () => {
        const fx = (fixture = makeFixture());

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const variablesAtPrime = read(fx.variablesPath);

        // Edit a token value.
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

        // The edit actually changed variables (guards against a vacuous match).
        expect(incrementalVariables).not.toBe(variablesAtPrime);
        expect(incrementalVariables).toContain("#abcdef");
        // Incremental matches a cold build byte-for-byte.
        expect(incrementalVariables).toBe(coldVariables);
        expect(incrementalUtilities).toBe(coldUtilities);
    });

    it("markup change leaves a themed (multi-permutation) variables file identical to cold", async () => {
        const fx = (fixture = makeFixture({ themed: true }));

        const warm = createWatchSession(fx.config, {});
        await warm.primeAndBuild();
        const variablesAtPrime = read(fx.variablesPath);
        // Sanity: the fixture really produced multiple permutation blocks.
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
        // The multi-block variables file is untouched by the markup change and
        // matches a full cold rebuild.
        expect(variablesAfterMarkup).toBe(variablesAtPrime);
        expect(variablesAfterMarkup).toBe(coldVariables);
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
});
