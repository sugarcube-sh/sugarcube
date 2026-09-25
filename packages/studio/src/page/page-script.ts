import { createPageScriptChannel } from "devframe/in-page-channel";
import { STUDIO_PAGE_CHANNEL, type StudioPageProtocol } from "./protocol";

/**
 * The dock injects this script into the user's page and runs this function
 * once, as the page loads. It opens the stylesheet studio writes CSS into.
 */
export default function setup(): void {
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

    createPageScriptChannel<StudioPageProtocol>({
        name: STUDIO_PAGE_CHANNEL,
        // The dock is served from studio's own origin, and the page can be on any.
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
