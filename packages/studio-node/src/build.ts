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
    /** The folder to serve at the site root. The hub lands at `<outDir>/__devframes/`. */
    outDir: string;
    /** Where a save goes from the built Studio: a service that opens a pull request. */
    saveUrl?: string;
};

export type StudioBuild = {
    /** The folder to serve at the site root: every URL below is relative to it. */
    rootDir: string;
    /** The hub subtree inside it, `<rootDir>/__devframes`. Not the folder to serve. */
    hubDir: string;
    /** The one tag a page adds to get the dock, relative to the site root. */
    embedTag: string;
    /** Where Studio opens full width, relative to the site root. */
    studioPath: string;
    /** What the token source had to say about the load, one sentence each. */
    errors: readonly string[];
};

const nothingToBuild = (errors: readonly string[]) =>
    ["[studio] Nothing to build: the token source loaded no tokens.", ...errors].join(" ");

/**
 * Studio with no server: devframe's static hub build over this project. The
 * output boots from a dump with nothing behind it, so any file server, a
 * staging site's dist/, or an upload can host it. Run at the project root:
 * the token file paths inside are whatever core saw from the working
 * directory, and a save replays them against the repository by that path.
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
