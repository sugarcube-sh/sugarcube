import { resolve } from "node:path";
import { DEVFRAMES_HUB_BASE } from "@devframes/hub/initiate";
import { buildHub } from "@devframes/hub/build";
import { clientPath } from "@sugarcube-sh/studio/client";
import {
    STUDIO_SURFACE,
    type StudioTokenSource,
    createNodeTokenSource,
    studioDevframe,
} from "@sugarcube-sh/studio/server";
import { HUB_NAME, hubUi, studioDock } from "./studio-hub";

export type BuildStudioOptions = {
    source?: StudioTokenSource;
    outDir: string;
    /** A static build cannot write files, so saves are posted here instead, to
     * a service that opens a pull request. */
    saveUrl?: string;
};

export type StudioBuild = {
    rootDir: string;
    hubDir: string;
    /** Paste this into a page and studio appears on it. The src is relative to
     * the site root, so the build has to be served from there. */
    embedTag: string;
    /** The path where studio opens on a page of its own, rather than over someone's. */
    studioPath: string;
    errors: readonly string[];
};

const nothingToBuild = (errors: readonly string[]) =>
    ["[studio] Nothing to build: the token source loaded no tokens.", ...errors].join(" ");

/**
 * Builds studio into plain files that any web server can host, with nothing
 * running behind them. Run it from the project root: the paths to the token
 * files are worked out from the directory you run in, and a save later replays
 * the edits against those same paths in the repository. Run it from anywhere
 * else and a save will aim at files that are not there.
 */
export async function buildStudio(options: BuildStudioOptions): Promise<StudioBuild> {
    const { source = createNodeTokenSource(), outDir, saveUrl } = options;

    await source.ready;
    if (!source.resolved) throw new Error(nothingToBuild(source.errors ?? []));

    const base = DEVFRAMES_HUB_BASE;
    const rootDir = resolve(outDir);
    const hubDir = resolve(rootDir, base.replace(/^\/|\/$/g, ""));

    await buildHub({
        outDir: hubDir,
        base,
        name: HUB_NAME,
        devframes: [studioDock(studioDevframe({ source, clientAssets: clientPath, saveUrl }))],
        ui: hubUi(),
    });

    return {
        rootDir,
        hubDir,
        embedTag: `<script type="module" src="${base}embedded.js"></script>`,
        studioPath: `${base}${STUDIO_SURFACE.id}/`,
        errors: source.errors ?? [],
    };
}
