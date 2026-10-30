import { resolve } from "node:path";
import { buildHub } from "@devframes/hub/build";
import { BUILT_APP } from "../built-files";
import { studioHub } from "../hub/studio-hub";
import type { GitSaveSettings } from "../protocol";
import { studioDevframe } from "../server/definition";
import type { StudioFiles } from "../server/files";
import { STUDIO_DOCK_SCRIPT, STUDIO_ROUTE } from "../studio-names";
import { projectFiles, refuseEmpty } from "./project-files";
import { gitIn, gitSaveFor } from "./save-settings";

export type BuildStudioOptions = {
    outDir: string;
};

export type StudioBuild = {
    rootDir: string;
    embedTag: string;
    studioPath: string;
    gitSave: GitSaveSettings | undefined;
    warnings: readonly string[];
};

export async function buildStudio(options: BuildStudioOptions): Promise<StudioBuild> {
    return buildFiles(await projectFiles(), options);
}

export async function buildFiles(
    files: StudioFiles,
    { outDir }: BuildStudioOptions,
): Promise<StudioBuild> {
    const cwd = process.cwd();
    refuseEmpty(files, cwd);
    const { config } = files.now();
    const { gitSave, warnings } = gitSaveFor({
        ...(config.studio && { studio: config.studio }),
        resolver: config.resolver,
        cwd,
        git: gitIn(cwd),
    });

    const hub = studioHub(studioDevframe({ files, clientAssets: BUILT_APP, gitSave }));
    const rootDir = resolve(outDir);
    const hubDir = resolve(rootDir, hub.base.replace(/^\/|\/$/g, ""));

    await buildHub({ ...hub, outDir: hubDir });

    return {
        rootDir,
        embedTag: `<script type="module" src="${STUDIO_DOCK_SCRIPT}"></script>`,
        studioPath: STUDIO_ROUTE,
        gitSave,
        warnings,
    };
}
