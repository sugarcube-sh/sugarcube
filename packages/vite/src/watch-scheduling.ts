/**
 * Scheduling helpers for the dev-server token watcher: a trailing debounce to
 * collapse bursts of saves, and a single-flight guard so a slow reload can't be
 * run concurrently with itself (which would race on the plugin's shared token/CSS
 * state). Kept local and small; unit-tested in tests/watch-scheduling.test.ts.
 */

export type Debounced = (() => void) & { cancel: () => void };

/** Trailing debounce: collapses a burst of calls into one after `wait` ms of quiet. */
export function debounce(fn: () => void, wait: number): Debounced {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const debounced = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            fn();
        }, wait);
    };

    debounced.cancel = () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
    };

    return debounced;
}

/**
 * Serialize an async function so it never runs concurrently. If it's called
 * while a run is in flight, exactly one more run happens after the current one
 * finishes (coalescing any number of triggers into a single trailing run).
 *
 * A throwing run is routed to `onError` (a reload can legitimately throw on
 * transient invalid JSON mid-edit); the error is caught per run so it never
 * escapes as an unhandled rejection and the loop still drains a pending trigger.
 */
export function createSingleFlight(
    fn: () => Promise<void>,
    onError?: (error: unknown) => void,
): () => void {
    let running = false;
    let pending = false;

    const run = async () => {
        if (running) {
            pending = true;
            return;
        }
        running = true;
        try {
            do {
                pending = false;
                try {
                    await fn();
                } catch (error) {
                    onError?.(error);
                }
            } while (pending);
        } finally {
            running = false;
        }
    };

    return () => {
        void run();
    };
}
