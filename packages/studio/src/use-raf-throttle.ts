import { useCallback, useEffect, useRef } from "react";

// Throttle a callback to at most one execution per animation frame.
export function useRafThrottle<Args extends unknown[]>(
    callback: (...args: Args) => void
): (...args: Args) => void {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const argsRef = useRef<Args | null>(null);
    const frameRef = useRef<number | null>(null);

    useEffect(
        () => () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        },
        []
    );

    return useCallback((...args: Args) => {
        argsRef.current = args;
        if (frameRef.current !== null) return;
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            const latest = argsRef.current;
            argsRef.current = null;
            if (latest) callbackRef.current(...latest);
        });
    }, []);
}
