export type DebouncedFn<Args extends unknown[]> = ((...args: Args) => void) & {
    cancel: () => void;
};

export function debounce<Args extends unknown[]>(
    fn: (...args: Args) => void,
    wait: number
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
