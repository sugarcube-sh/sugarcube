import { connectPanelChannel } from "devframe/in-page-channel";
import { followCSS } from "../controllers/page-css";
import type { Studio } from "../controllers/studio";
import type { StudioPageProtocol } from "../page/protocol";
import { STUDIO_PAGE_CHANNEL } from "../studio-names";

export function attachPageChannel(studio: Studio): () => void {
    const channel = connectPanelChannel<StudioPageProtocol>({
        name: STUDIO_PAGE_CHANNEL,
        allowedOrigins: ["*"],
        functions: {},
    });

    let stop = () => {};
    const unsubStatus = channel.events.on("status:updated", (status) => {
        if (status !== "connected") return;
        stop();
        stop = followCSS(studio, (css) => channel.emit("css", css), requestAnimationFrame);
    });

    return () => {
        stop();
        unsubStatus();
        channel.close();
    };
}
