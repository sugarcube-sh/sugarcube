import { type KeyboardEvent, useCallback, useRef } from "react";

type RovingOptions = {
    /** Total number of items */
    count: number;
    /** Number of columns for grid navigation (arrow up/down skip by this). Default 1 (linear list). */
    columns?: number;
    /** Called when the active index changes */
    onActivate: (index: number) => void;
};

/**
 * Provides keyboard navigation for radio groups and grids.
 * - Arrow Left/Up: previous item
 * - Arrow Right/Down: next item
 * - Home: first item
 * - End: last item
 * - In grid mode, Up/Down move by column count
 *
 * Returns props to spread on the container and a function to get props for each item.
 */
export function useRovingIndex({ count, columns = 1, onActivate }: RovingOptions) {
    const containerRef = useRef<HTMLDivElement>(null);

    const focusIndex = useCallback((index: number) => {
        const container = containerRef.current;
        if (!container) return;
        const items = container.querySelectorAll<HTMLElement>('[role="radio"], [role="gridcell"]');
        items[index]?.focus();
    }, []);

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const container = containerRef.current;
            if (!container) return;

            const items = container.querySelectorAll<HTMLElement>(
                '[role="radio"], [role="gridcell"]'
            );
            const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);
            if (currentIndex === -1) return;

            let nextIndex: number | null = null;

            switch (e.key) {
                case "ArrowRight":
                    nextIndex = (currentIndex + 1) % count;
                    break;
                case "ArrowLeft":
                    nextIndex = (currentIndex - 1 + count) % count;
                    break;
                case "ArrowDown":
                    nextIndex = currentIndex + columns;
                    if (nextIndex >= count) nextIndex = null;
                    break;
                case "ArrowUp":
                    nextIndex = currentIndex - columns;
                    if (nextIndex < 0) nextIndex = null;
                    break;
                case "Home":
                    nextIndex = 0;
                    break;
                case "End":
                    nextIndex = count - 1;
                    break;
                default:
                    return;
            }

            if (nextIndex === null) return;

            e.preventDefault();
            focusIndex(nextIndex);
            onActivate(nextIndex);
        },
        [count, columns, onActivate, focusIndex]
    );

    return {
        containerRef,
        containerProps: { onKeyDown, ref: containerRef },
    };
}
