import { createPageScriptChannel } from "devframe/in-page-channel";
import { STUDIO_PAGE_CHANNEL } from "../studio-names";
import type { StudioPageProtocol } from "./protocol";

export default function setup(): void {
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

    createPageScriptChannel<StudioPageProtocol>({
        name: STUDIO_PAGE_CHANNEL,
        allowedOrigins: ["*"],
        functions: {},
        events: {
            css: {
                handler: (css) => {
                    sheet.replaceSync(css);
                },
            },
        },
    });
}
