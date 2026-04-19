import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadInternalConfig } from "@sugarcube-sh/core";
import { embedPath } from "@sugarcube-sh/studio-embed/path";
import { clientPath } from "@sugarcube-sh/studio/client";
import { Command } from "commander";
import color from "picocolors";
import { loadAndResolveTokensForCLI } from "../pipelines/load-and-resolve-for-cli.js";
import { intro, outro } from "../prompts/common.js";
import { handleError } from "../utils/handle-error.js";

export const studio = new Command().name("studio").description("Studio tools for sugarcube");

studio
    .command("build")
    .description(
        "Generate a token snapshot and copy the Studio SPA assets for embedded/published mode"
    )
    .option("-o, --out <path>", "Output directory", ".sugarcube")
    .action(async (opts) => {
        try {
            intro("studio build");

            const outDir = path.resolve(opts.out);
            const startedAt = Date.now();

            const { config } = await loadInternalConfig();
            const { trees, resolved } = await loadAndResolveTokensForCLI(config);

            // `resolver` is a filesystem path — useless in the browser.
            const { resolver, ...snapshotConfig } = config;

            const snapshot = {
                formatVersion: 1 as const,
                generatedAt: new Date().toISOString(),
                config: snapshotConfig,
                trees,
                resolved,
            };

            await mkdir(outDir, { recursive: true });

            const snapshotPath = path.join(outDir, "snapshot.json");
            await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");
            const snapshotSizeKB = (Buffer.byteLength(JSON.stringify(snapshot)) / 1024).toFixed(1);

            await cp(clientPath, outDir, { recursive: true });
            await cp(embedPath, path.join(outDir, "embed.js"));

            const ms = Date.now() - startedAt;
            const relOut = path.relative(process.cwd(), outDir);

            outro(
                `Studio assets written in ${ms}ms → ${color.cyan(relOut)} (snapshot: ${snapshotSizeKB} KB)`
            );
        } catch (err) {
            handleError(err);
        }
    });
