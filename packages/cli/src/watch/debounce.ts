/**
 * Creates a debounced function that delays invoking the provided function
 * until after `wait` milliseconds have elapsed since the last time it was invoked.
 */
export function debounce<Args extends unknown[]>(
    fn: (...args: Args) => void,
    wait: number
): (...args: Args) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return (...args: Args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
        }, wait);
    };
}
