import { createUi } from "@devframes/hub-ui";
import type { DevframeDefinition } from "devframe";
import { pageScriptPath } from "@sugarcube-sh/studio/client";
import { STUDIO_ICON } from "@sugarcube-sh/studio/server";

/**
 * Two devframe words, used throughout studio: the hub is the server that hosts
 * devframes and owns the shell UI around them, and a dock is one devframe
 * mounted onto the user's page as an overlay, with its client script injected
 * into that page alongside it.
 */

export const HUB_NAME = "sugarcube";

export function hubUi() {
    return createUi({ branding: { productName: HUB_NAME, logo: STUDIO_ICON } });
}

export function studioDock(devframe: DevframeDefinition) {
    return {
        devframe,
        dock: { clientScript: { importFrom: pageScriptPath, eager: true } },
    };
}
