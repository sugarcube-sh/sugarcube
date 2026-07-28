/**
 * Wraps an async function so overlapping calls can't run concurrently. While a
 * run is in flight, only the most recent pending args are kept; when the current
 * run finishes, it fires once more with those args. Intermediate calls collapse
 * into that single trailing run.
 *
 * This guards watch regeneration: a rebuild can take longer than the gap between
 * file events, and without this a second rebuild could start mid-flight and race
 * the first on the same output files. Errors are routed to `onError` so a
 * rejected run still releases the lock and drains any queued call.
 */
export function createCoalescedRunner<Args extends unknown[]>(
    fn: (...args: Args) => Promise<void>,
    onError: (error: unknown) => void,
): (...args: Args) => void {
    let running = false;
    let queued: Args | null = null;

    const run = async (...args: Args): Promise<void> => {
        if (running) {
            queued = args;
            return;
        }
        running = true;
        try {
            await fn(...args);
        } catch (error) {
            onError(error);
        } finally {
            running = false;
            if (queued) {
                const next = queued;
                queued = null;
                void run(...next);
            }
        }
    };

    return (...args: Args) => {
        void run(...args);
    };
}
