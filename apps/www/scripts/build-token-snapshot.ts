/**
 * Builds a snapshot of the project's resolved tokens for the in-browser
 * pipeline demo (and, eventually, the published studio).
 *
 * Reads the project's sugarcube.config.ts, runs `loadAndResolveTokens` via
 * the Node entry of `@sugarcube-sh/core`, and writes the result to
 * `apps/www/.sugarcube/tokens-snapshot.json`. The demo's React component
 * imports that snapshot via a Vite alias and uses it as the in-memory token
 * tree.
 *
 * This is intentionally a thin wrapper around the existing core API. The
 * same logic will eventually be extracted into a reusable function and
 * wrapped in a `sugarcube studio publish` CLI command for the published-
 * studio mode (see notes/studio-published-mode.md). For now, the apps/www
 * version proves the mechanism end-to-end.
 *
 * Wired into apps/www/package.json as a `predev` and `prebuild` step so the
 * snapshot is always regenerated before the dev server or build runs.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAndResolveTokens, loadInternalConfig } from "@sugarcube-sh/core";
import type { TokenPipelineSource } from "@sugarcube-sh/core";

const SNAPSHOT_PATH = path.join(process.cwd(), ".sugarcube", "tokens-snapshot.json");

async function build() {
    const startedAt = Date.now();

    const { config, configPath } = await loadInternalConfig();

    if (!config.resolver) {
        throw new Error(
            `sugarcube.config.ts at ${configPath} has no \`resolver\` configured. The snapshot script needs a resolver to load tokens from.`
        );
    }

    const source: TokenPipelineSource = {
        type: "resolver",
        resolverPath: config.resolver,
        config,
    };

    const result = await loadAndResolveTokens(source);

    if (result.errors.load.length > 0) {
        console.error("Token loading failed:");
        for (const err of result.errors.load) {
            console.error(`  ${err.file}: ${err.message}`);
        }
        process.exit(1);
    }

    if (result.errors.flatten.length > 0) {
        console.error("Token flattening failed:");
        for (const err of result.errors.flatten) {
            console.error(`  ${err.message}`);
        }
        process.exit(1);
    }

    if (result.errors.validation.length > 0) {
        console.error("Token validation failed:");
        for (const err of result.errors.validation) {
            console.error(`  ${err.path}: ${err.message}`);
        }
        process.exit(1);
    }

    if (result.errors.resolution.length > 0) {
        console.error("Token resolution failed:");
        for (const err of result.errors.resolution) {
            console.error(`  ${err.message}`);
        }
        process.exit(1);
    }

    const snapshot = {
        // Format version so future snapshot consumers can detect incompatible bundles
        formatVersion: 1 as const,
        // When the snapshot was generated (for staleness checks later)
        generatedAt: new Date().toISOString(),
        // The path to the config that produced this snapshot (for debugging)
        sourceConfigPath: path.relative(process.cwd(), configPath),
        // The validated internal config — needed by the in-browser pipeline
        // (processAndConvertTokens etc. take a config alongside the tokens)
        config,
        // The expanded token trees (with $ref/$extends inlined)
        trees: result.trees,
        // The fully resolved tokens (after expand → flatten → validate → dereference)
        resolved: result.resolved,
        // Non-blocking warnings from the resolver, useful to surface in the demo
        warnings: result.warnings,
    };

    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");

    const ms = Date.now() - startedAt;
    const sizeKB = (Buffer.byteLength(JSON.stringify(snapshot)) / 1024).toFixed(1);
    console.log(
        `Wrote token snapshot in ${ms}ms: ${path.relative(process.cwd(), SNAPSHOT_PATH)} (${sizeKB} KB)`
    );
}

build().catch((err) => {
    console.error("Failed to build token snapshot:", err);
    process.exit(1);
});
