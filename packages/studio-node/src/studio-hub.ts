import { createUi } from "@devframes/hub-ui";
import type { DevframeDefinition } from "devframe";
import { pageScriptPath } from "@sugarcube-sh/studio/client";
import { STUDIO_ICON } from "@sugarcube-sh/studio/server";

/** What both hosts, the server and the build, tell devframe about the hub. */
export const HUB_NAME = "sugarcube";

export function hubUi() {
    return createUi({ branding: { productName: HUB_NAME, logo: STUDIO_ICON } });
}

/**
 * Studio as a dock with its page script: the hub hosts the script's folder
 * and imports it into the page, which is how the CSS of an edit reaches it.
 */
export function studioDock(devframe: DevframeDefinition) {
    return {
        devframe,
        dock: { clientScript: { importFrom: pageScriptPath, eager: true } },
    };
}
