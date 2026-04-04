import { type PointerEvent, useCallback, useRef, useState } from "react";

type Position = { x: number; y: number };

export function useDraggable(initialPosition: Position = { x: 16, y: 16 }) {
    const [position, setPosition] = useState<Position>(initialPosition);
    const dragOffset = useRef<Position>({ x: 0, y: 0 });

    const onPointerDown = useCallback(
        (e: PointerEvent) => {
            // Only drag from the header itself, not from buttons inside it
            if ((e.target as HTMLElement).closest("button")) return;

            dragOffset.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            };

            const el = e.currentTarget as HTMLElement;
            el.setPointerCapture(e.pointerId);
        },
        [position]
    );

    const onPointerMove = useCallback((e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (!el.hasPointerCapture(e.pointerId)) return;

        setPosition({
            x: Math.max(0, e.clientX - dragOffset.current.x),
            y: Math.max(0, e.clientY - dragOffset.current.y),
        });
    }, []);

    const onPointerUp = useCallback((e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        if (el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
        }
    }, []);

    return {
        position,
        dragHandleProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
        },
    };
}
