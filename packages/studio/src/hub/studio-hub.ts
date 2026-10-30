import { createUi } from "@devframes/hub-ui";
import type { DevframeDefinition } from "devframe";
import { BUILT_PAGE_SCRIPT } from "../built-files";
import { STUDIO_ICON } from "../server/icon";
import { STUDIO_HUB_BASE } from "../studio-names";

const HUB_NAME = "sugarcube";

export function studioHub(studio: DevframeDefinition) {
    return {
        base: STUDIO_HUB_BASE,
        name: HUB_NAME,
        ui: createUi({ branding: { productName: HUB_NAME, logo: STUDIO_ICON } }),
        devframes: [
            {
                devframe: studio,
                dock: { clientScript: { importFrom: BUILT_PAGE_SCRIPT, eager: true } },
            },
        ],
    };
}
