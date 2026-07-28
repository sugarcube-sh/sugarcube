import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fillDefaults } from "@sugarcube-sh/core";
import type { InternalConfig } from "@sugarcube-sh/core";
import { afterAll, beforeAll, bench, describe } from "vitest";
import { createWatchSession } from "../../src/watch/regenerate.js";

// Measures the cost of a single watch change-event on an already-running
// session, at a few project sizes. In Phase 0 every scenario does a full
// rebuild (the pre-extraction behaviour), so this file captures the baseline
// that later phases compare against. See notes/watcher-perf-spec.md §5.

type Fixture = {
    config: InternalConfig;
    markupPaths: string[];
    tokenPath: string;
    cleanup: () => void;
};

const COLORS_PER_FILE = 50;

// Writes a real temp project: 1 resolver + N token files + M markup files.
// Shapes are verified against the real schemas (resolver.ts, utilities.ts, DTCG).
// `permutations` > 1 adds a `theme` modifier with that many contexts, so the
// resolver auto-derives that many permutations (a `:root` block + one
// `[data-theme="…"]` variables block per non-default context). A markup change
// skips regenerating all of them; a cold build / token change pays for all.
function makeFixture(opts: {
    tokenFiles: number;
    markupFiles: number;
    classesPerFile: number;
    permutations?: number;
}): Fixture {
    const dir = mkdtempSync(join(tmpdir(), "sugarcube-watch-bench-"));
    const tokensDir = join(dir, "tokens");
    const srcDir = join(dir, "src");
    mkdirSync(tokensDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });

    // One token file per set-source, each contributing a distinct subgroup under
    // `color` so cross-file refs don't collide. DTCG shape; refs are dotted paths.
    const refs: Array<{ $ref: string }> = [];
    const classNames: string[] = []; // the class names the utility config will emit
    const baseLeaves: string[] = []; // base (non-ref) leaves, for context overrides
    for (let f = 0; f < opts.tokenFiles; f++) {
        const group: Record<string, unknown> = { $type: "color" };
        for (let i = 0; i < COLORS_PER_FILE; i++) {
            const leaf = `f${f}-${i}`;
            if (i % 3 === 0) {
                group[leaf] = { $value: "#ff0000" }; // base color
                baseLeaves.push(leaf);
            } else {
                group[leaf] = { $value: `{color.f${f}-${i - (i % 3)}}` }; // ref to nearest base
            }
            classNames.push(`text-${leaf}`); // prefix "text" + token leaf → class
        }
        const fileName = `set-${f}.json`;
        writeFileSync(join(tokensDir, fileName), JSON.stringify({ color: group }));
        refs.push({ $ref: `tokens/${fileName}` }); // $ref relative to the resolver file
    }

    const resolutionOrder: unknown[] = [{ type: "set", name: "base", sources: refs }];

    const permutations = opts.permutations ?? 1;
    if (permutations > 1) {
        // One modifier with `permutations` contexts: context "c0" is the default
        // (empty), each other context overrides a slice of base colors so every
        // permutation resolves to distinct values.
        const overrideLeaves = baseLeaves.slice(0, 20);
        const contexts: Record<string, unknown[]> = { c0: [] };
        for (let c = 1; c < permutations; c++) {
            const overrides: Record<string, unknown> = {};
            for (const leaf of overrideLeaves) {
                overrides[leaf] = {
                    $type: "color",
                    $value: `#${(c * 17).toString(16).padStart(2, "0").repeat(3)}`,
                };
            }
            contexts[`c${c}`] = [{ color: overrides }];
        }
        resolutionOrder.push({ type: "modifier", name: "theme", default: "c0", contexts });
    }

    const resolverPath = join(dir, "tokens.resolver.json");
    writeFileSync(
        resolverPath,
        JSON.stringify({ version: "2025.10", name: "watch-bench", resolutionOrder }),
    );

    // Markup files using a rotating slice of the real class names.
    const markupPaths: string[] = [];
    for (let m = 0; m < opts.markupFiles; m++) {
        const classes = Array.from(
            { length: opts.classesPerFile },
            (_, k) => classNames[(m * opts.classesPerFile + k) % classNames.length],
        ).join(" ");
        const p = join(srcDir, `component-${m}.html`);
        writeFileSync(p, `<div class="${classes}">hello</div>\n`);
        markupPaths.push(p);
    }

    const config = fillDefaults({
        resolver: resolverPath,
        content: [join(srcDir, "**/*.html")],
        variables: { path: join(dir, "out/tokens.css") },
        utilities: {
            path: join(dir, "out/utilities.css"),
            // Key = CSS property; `source` is a token-path glob; `prefix` names the
            // class. color.f0-0 → class `text-f0-0`.
            classes: { color: { source: "color.*", prefix: "text" } },
        },
    });

    return {
        config,
        markupPaths,
        tokenPath: join(tokensDir, "set-0.json"),
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

const SIZES = [
    { label: "500 markup files", markupFiles: 500, tokenFiles: 4, classesPerFile: 20 },
    { label: "5,000 markup files", markupFiles: 5000, tokenFiles: 8, classesPerFile: 20 },
    // Token-heavy, markup-light: a mature design system (~500 authored tokens
    // across 10 files) with modest markup, no permutations. Reference for the
    // themed rows below. "single markup change" skips the token pipeline +
    // variables that "cold build" pays — the gap between those two rows is the
    // routing win. Markup-dominated sizes above barely move (trivial tokens).
    {
        label: "~500 tokens, no permutations, 200 markup",
        markupFiles: 200,
        tokenFiles: 10,
        classesPerFile: 10,
    },
    // Themed: the common case. Each permutation is a full variable render that a
    // markup change skips, so the routing win should grow with permutation count.
    {
        label: "~500 tokens, light/dark (2 perms), 200 markup",
        markupFiles: 200,
        tokenFiles: 10,
        classesPerFile: 10,
        permutations: 2,
    },
    {
        label: "~500 tokens, 4 themes (4 perms), 200 markup",
        markupFiles: 200,
        tokenFiles: 10,
        classesPerFile: 10,
        permutations: 4,
    },
];

// One fixture per size, built once at collection time and reused across every
// sample — so the measured samples time generation, not fixture setup, and
// cleanup handles just a couple of temp dirs.
const fixtures: Fixture[] = [];
afterAll(() => {
    for (const f of fixtures) f.cleanup();
}, 60_000);

for (const size of SIZES) {
    const fx = makeFixture(size);
    fixtures.push(fx);

    describe(size.label, () => {
        // Cold build — full generation from scratch (baseline reference). A fresh
        // session each sample; session creation is cheap, the fixture is reused.
        bench("cold build", async () => {
            const session = createWatchSession(fx.config, {});
            await session.primeAndBuild();
        });

        // Warm sessions: primed once, then each sample measures one change event.
        const markupSession = createWatchSession(fx.config, {});
        const tokenSession = createWatchSession(fx.config, {});
        beforeAll(async () => {
            await markupSession.primeAndBuild();
            await tokenSession.primeAndBuild();
        }, 60_000);

        // One markup file edited on a warm session — the common hot path.
        bench("single markup change (warm)", async () => {
            writeFileSync(fx.markupPaths[0], `<div class="text-f0-1">edited</div>\n`);
            await markupSession.onChange("markup", fx.markupPaths[0]);
        });

        // One token file edited on a warm session (a value change, structure intact).
        bench("single token change (warm)", async () => {
            writeFileSync(
                fx.tokenPath,
                JSON.stringify({
                    color: {
                        "$type": "color",
                        "f0-0": { $value: "#00ff00" },
                        "f0-1": { $value: "{color.f0-0}" },
                    },
                }),
            );
            await tokenSession.onChange("token", fx.tokenPath);
        });
    });
}
