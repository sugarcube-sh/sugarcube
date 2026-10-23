import { tokensOnDisk } from "@sugarcube-sh/core";
import { ErrorMessages } from "../error-messages";
import type { StudioMessage } from "../protocol";
import { STUDIO_DEVFRAME_ID, STUDIO_ROUTE, STUDIO_RPC } from "../studio-names";
import type { FilesNow, StudioFiles } from "./files";
import { studioMessage } from "./message";
import { saveEdits } from "./save";
import type { DefineStudioOptions, StudioHostBridge, StudioSurface } from "./types";

export const STUDIO_SURFACE: StudioSurface = {
    id: STUDIO_DEVFRAME_ID,
    title: "studio",
    route: STUDIO_ROUTE,
};

export async function defineStudio(
    files: StudioFiles,
    host: StudioHostBridge,
    options: DefineStudioOptions = {},
): Promise<void> {
    if (options.gitSave) host.publishConfig?.({ gitSave: options.gitSave });

    let warnedNaming = false;
    const message = (now: FilesNow): StudioMessage => {
        if (!warnedNaming && typeof now.config.variables.variableName === "function") {
            warnedNaming = true;
            host.warn(ErrorMessages.NAMING_DROPPED);
        }
        return studioMessage(now);
    };

    const shared = await host.sharedState<StudioMessage>(STUDIO_RPC.MESSAGE, message(files.now()));
    files.onChange(() => {
        const next = message(files.now());
        shared.mutate((draft) => Object.assign(draft, next));
    });

    host.registerAction<[unknown]>(STUDIO_RPC.SAVE, (sent) =>
        saveEdits(tokensOnDisk(files.now().config), sent),
    );
}
