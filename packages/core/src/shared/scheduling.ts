export type DebouncedFn<Args extends unknown[]> = ((...args: Args) => void) & {
    cancel: () => void;
};

export function debounce<Args extends unknown[]>(
    fn: (...args: Args) => void,
    wait: number,
): DebouncedFn<Args> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const debounced = (...args: Args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = undefined;
            fn(...args);
        }, wait);
    };

    debounced.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }
    };

    return debounced;
}

/**
 * Serialises an async function so it never runs concurrently: a call made while
 * a run is in flight is queued, and exactly one more run happens afterwards,
 * with the latest arguments. A rebuild can take longer than the gap between
 * file events, and without this a second rebuild could start mid-flight and
 * race the first on the same output files. Errors are routed to `onError` so a
 * rejected run still releases the lock and drains any queued call.
 */
export function createCoalescedRunner<Args extends unknown[]>(
    fn: (...args: Args) => Promise<void>,
    onError?: (error: unknown) => void,
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
            onError?.(error);
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
