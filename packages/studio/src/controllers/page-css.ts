import type { Studio } from "./studio";

export function watchCSS(
    studio: Studio,
    send: (css: string) => void,
    schedule: (run: () => void) => void,
): () => void {
    let lastSentCSS: string | undefined;
    let waiting = false;
    let stopped = false;

    const flush = () => {
        waiting = false;
        if (stopped || studio.state.css === lastSentCSS) return;
        lastSentCSS = studio.state.css;
        send(lastSentCSS);
    };
    const scheduleSend = () => {
        if (waiting || studio.state.css === lastSentCSS) return;
        waiting = true;
        schedule(flush);
    };

    const stop = studio.subscribe(scheduleSend);
    scheduleSend();

    return () => {
        stopped = true;
        stop();
    };
}
