import { getTokensOnDisk } from "@sugarcube-sh/core";
import { ErrorMessages } from "../error-messages";
import type { StudioMessage } from "../protocol";
import { STUDIO_DEVFRAME_ID, STUDIO_ROUTE, STUDIO_RPC } from "../studio-names";
import type { FilesSnapshot, StudioFiles } from "./files";
import { toStudioMessage } from "./message";
import { saveEdits } from "./save";
import type { SetupStudioOptions, StudioHostBridge, StudioDock } from "./types";

export const STUDIO_DOCK: StudioDock = {
    id: STUDIO_DEVFRAME_ID,
    title: "studio",
    route: STUDIO_ROUTE,
};

export async function setupStudio(
    files: StudioFiles,
    host: StudioHostBridge,
    options: SetupStudioOptions = {},
): Promise<void> {
    if (options.gitSave) host.publishConfig?.({ gitSave: options.gitSave });

    let warnedNaming = false;
    const createMessage = (snapshot: FilesSnapshot): StudioMessage => {
        if (!warnedNaming && typeof snapshot.config.variables.variableName === "function") {
            warnedNaming = true;
            host.warn(ErrorMessages.NAMING_DROPPED);
        }
        return toStudioMessage(snapshot);
    };

    const sharedMessage = await host.sharedState<StudioMessage>(
        STUDIO_RPC.MESSAGE,
        createMessage(files.getSnapshot()),
    );
    files.onChange(() => {
        const next = createMessage(files.getSnapshot());
        sharedMessage.mutate((draft) => Object.assign(draft, next));
    });

    host.registerAction<[unknown]>(STUDIO_RPC.SAVE, (payload) =>
        saveEdits(getTokensOnDisk(files.getSnapshot().config), payload),
    );
}
