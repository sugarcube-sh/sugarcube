import { createPageScriptChannel } from "devframe/in-page-channel";
import { STUDIO_PAGE_CHANNEL, type StudioPageProtocol } from "./protocol";

/**
 * The hub imports this module into the host page and calls its default export
 * once, with its client context, after RPC trust.
 *
 * The CSS lives in an adopted stylesheet, which the cascade places after every
 * stylesheet of the document itself, however late those arrive. So a live edit
 * wins over the page's own token CSS without anything being moved.
 */
export default function setup(): void {
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

    createPageScriptChannel<StudioPageProtocol>({
        name: STUDIO_PAGE_CHANNEL,
        // Studio's dock is served from its own origin; the page can be on any.
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
