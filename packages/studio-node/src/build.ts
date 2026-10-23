import { resolve } from "node:path";
import { DEVFRAMES_HUB_BASE } from "@devframes/hub/initiate";
import { buildHub } from "@devframes/hub/build";
import { clientPath } from "@sugarcube-sh/studio/client";
import {
    type GitSaveSettings,
    STUDIO_SURFACE,
    type StudioFiles,
    projectFiles,
    refuseEmpty,
    studioDevframe,
} from "@sugarcube-sh/studio/server";
import { gitIn, gitSaveFor } from "./source";
import { HUB_NAME, hubUi, studioDock } from "./studio-hub";

export type BuildStudioOptions = {
    files?: StudioFiles;
    outDir: string;
};

export type StudioBuild = {
    rootDir: string;
    hubDir: string;
    /** Paste this into a page and studio appears on it. The src is relative to
     * the site root, so the build has to be served from there. */
    embedTag: string;
    /** The path where studio opens on a page of its own, rather than over someone's. */
    studioPath: string;
    gitSave: GitSaveSettings | undefined;
    warnings: readonly string[];
};

/**
 * Builds studio into plain files that any web server can host, with nothing
 * running behind them. A save from the built studio opens a pull request on the
 * repository named in sugarcube.config.ts's studio settings, against the branch being built.
 */
export async function buildStudio(options: BuildStudioOptions): Promise<StudioBuild> {
    const { outDir } = options;
    const files = options.files ?? (await projectFiles());

    refuseEmpty(files);
    const cwd = process.cwd();
    const { config } = files.now();
    const { gitSave, warnings } = gitSaveFor({
        ...(config.studio && { studio: config.studio }),
        resolver: config.resolver,
        cwd,
        git: gitIn(cwd),
    });

    const base = DEVFRAMES_HUB_BASE;
    const rootDir = resolve(outDir);
    const hubDir = resolve(rootDir, base.replace(/^\/|\/$/g, ""));

    await buildHub({
        outDir: hubDir,
        base,
        name: HUB_NAME,
        devframes: [studioDock(studioDevframe({ files, clientAssets: clientPath, gitSave }))],
        ui: hubUi(),
    });

    return {
        rootDir,
        hubDir,
        embedTag: `<script type="module" src="${base}embedded.js"></script>`,
        studioPath: `${base}${STUDIO_SURFACE.id}/`,
        gitSave,
        warnings,
    };
}
