import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, bench, describe } from "vitest";
import { fillDefaults } from "../../src/node/config/normalize.js";
import { loadTokens } from "../../src/node/load-tokens.js";
import type { TokenPipelineSource } from "../../src/types/pipelines.js";

// Measures the cost of loading a resolver-backed token set from disk, varying
// the permutation count at a fixed number of token files.
//
// The `fileCache` that dedupes `$ref` reads is created per permutation
// (createResolveContext, called once per processResolutionOrder), so the same
// base token files are re-read + re-parsed once PER PERMUTATION. This bench
// exists to capture that scaling: today `loadTokens` time grows with the
// permutation count even though the files on disk are identical. A shared
// cross-permutation cache should flatten these rows.

const TOKENS_PER_FILE = 40;

function makeResolverFixture(opts: { tokenFiles: number; permutations: number }): {
    source: TokenPipelineSource;
    cleanup: () => void;
} {
    const dir = mkdtempSync(join(tmpdir(), "sugarcube-resolver-bench-"));
    const tokensDir = join(dir, "tokens");
    mkdirSync(tokensDir, { recursive: true });

    const refs: Array<{ $ref: string }> = [];
    const baseLeaves: string[] = [];
    for (let f = 0; f < opts.tokenFiles; f++) {
        const group: Record<string, unknown> = { $type: "color" };
        for (let i = 0; i < TOKENS_PER_FILE; i++) {
            const leaf = `f${f}-${i}`;
            if (i % 3 === 0) {
                group[leaf] = { $value: "#ff0000" };
                baseLeaves.push(leaf);
            } else {
                group[leaf] = { $value: `{color.f${f}-${i - (i % 3)}}` };
            }
        }
        const fileName = `set-${f}.json`;
        writeFileSync(join(tokensDir, fileName), JSON.stringify({ color: group }));
        refs.push({ $ref: `tokens/${fileName}` });
    }

    const resolutionOrder: unknown[] = [{ type: "set", name: "base", sources: refs }];
    if (opts.permutations > 1) {
        // One modifier with `permutations` contexts. Each non-default context
        // overrides a slice of base colors; every permutation still reprocesses
        // the base set, re-reading all base files under the current per-perm cache.
        const overrideLeaves = baseLeaves.slice(0, 30);
        const contexts: Record<string, unknown[]> = { c0: [] };
        for (let c = 1; c < opts.permutations; c++) {
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
        JSON.stringify({ version: "2025.10", name: "resolver-bench", resolutionOrder }),
    );

    const config = fillDefaults({
        resolver: resolverPath,
        variables: { path: join(dir, "out.css") },
    });

    return {
        source: { type: "resolver", resolverPath, config },
        cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
}

const CASES = [
    { label: "40 files, 1 permutation", tokenFiles: 40, permutations: 1 },
    { label: "40 files, 2 permutations", tokenFiles: 40, permutations: 2 },
    { label: "40 files, 4 permutations", tokenFiles: 40, permutations: 4 },
    { label: "40 files, 8 permutations", tokenFiles: 40, permutations: 8 },
];

const fixtures: Array<{ cleanup: () => void }> = [];
afterAll(() => {
    for (const f of fixtures) f.cleanup();
}, 60_000);

describe("resolver load — token-file reads scale with permutations", () => {
    for (const c of CASES) {
        const fx = makeResolverFixture(c);
        fixtures.push(fx);
        bench(c.label, async () => {
            await loadTokens(fx.source);
        });
    }
});
