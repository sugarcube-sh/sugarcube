import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadInternalConfig } from "@sugarcube-sh/core";
import { Command } from "commander";
import { relative } from "pathe";
import color from "picocolors";
import { CLIError } from "../cli-error.js";
import { handleError } from "../handle-error.js";
import { prepareTokens } from "../prepare-tokens.js";
import { intro, label, outro } from "../prompts/common.js";
import { log } from "../prompts/log.js";

async function loadStudioAssets(): Promise<{ clientPath: string; embedPath: string }> {
    try {
        const [{ clientPath }, { embedPath }] = await Promise.all([
            import("@sugarcube-sh/studio/client"),
            import("@sugarcube-sh/studio-embed/path"),
        ]);
        return { clientPath, embedPath };
    } catch {
        throw new CLIError(
            "Studio isn't available yet. `sugarcube studio build` will work once @sugarcube-sh/studio and @sugarcube-sh/studio-embed are published."
        );
    }
}

export const studio = new Command().name("studio").description("Studio tools for sugarcube");

studio
    .command("build")
    .description("Build Studio assets for embedded mode")
    .option("-o, --out <path>", "Output directory", ".sugarcube")
    .action(async (opts) => {
        try {
            intro(label("Studio build"));

            const outDir = path.resolve(opts.out);

            const { clientPath, embedPath } = await loadStudioAssets();
            const { config } = await loadInternalConfig();
            const { trees, resolved } = await prepareTokens(config);

            const { resolver, ...snapshotConfig } = config;

            const snapshot = {
                formatVersion: 1 as const,
                generatedAt: new Date().toISOString(),
                config: snapshotConfig,
                trees,
                resolved,
            };

            await mkdir(outDir, { recursive: true });

            const relOut = relative(process.cwd(), outDir);
            const snapshotTarget = `${path.join(relOut, "snapshot.json")}`;
            const spaTarget = `${relOut}/`;
            const embedTarget = `${path.join(relOut, "embed.js")}`;

            log.space(1);

            await log.tasks(
                [
                    {
                        pending: `Write snapshot to ${snapshotTarget}`,
                        start: `Writing snapshot to ${snapshotTarget}`,
                        end: `Wrote snapshot to ${snapshotTarget}`,
                        while: async () => {
                            await writeFile(
                                path.join(outDir, "snapshot.json"),
                                JSON.stringify(snapshot, null, 2),
                                "utf-8"
                            );
                        },
                    },
                    {
                        pending: `Write Studio SPA to ${spaTarget}`,
                        start: `Writing Studio SPA to ${spaTarget}`,
                        end: `Wrote Studio SPA to ${spaTarget}`,
                        while: async () => {
                            await cp(clientPath, outDir, { recursive: true });
                        },
                    },
                    {
                        pending: `Write embed script to ${embedTarget}`,
                        start: `Writing embed script to ${embedTarget}`,
                        end: `Wrote embed script to ${embedTarget}`,
                        while: async () => {
                            await cp(embedPath, path.join(outDir, "embed.js"));
                        },
                    },
                ],
                {
                    spacing: 0,
                    minDurationMs: 0,
                    successPauseMs: 100,
                }
            );

            outro(color.green("Studio assets ready."));
        } catch (err) {
            handleError(err);
        }
    });
