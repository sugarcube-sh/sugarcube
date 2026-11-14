import type { InPageChannelProtocol } from "devframe/in-page-channel";

export interface StudioPageProtocol extends InPageChannelProtocol {
    events: {
        pageScript: {
            css: (css: string) => void;
        };
    };
}
