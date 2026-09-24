import type { InPageChannelProtocol } from "devframe/in-page-channel";

export const STUDIO_PAGE_CHANNEL = "sugarcube:studio:page";

/**
 * Between Studio in the dock and the page it is docked on. The page holds a
 * `<style>` that Studio fills on every edit. That is the whole contract.
 */
export interface StudioPageProtocol extends InPageChannelProtocol {
    events: {
        pageScript: {
            css: (css: string) => void;
        };
    };
}
