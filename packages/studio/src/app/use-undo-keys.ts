import { useEffect } from "react";
import { type FocusedElement, getChangeBarActions, getUndoAction } from "../controllers/undo";
import { useStudio } from "../providers/studio-context";

export function useUndoKeys(): void {
    const studio = useStudio();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const action = getUndoAction(
                event,
                toFocused(event.target),
                getChangeBarActions(studio),
            );
            if (!action) return;
            event.preventDefault();
            studio[action]();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [studio]);
}

function toFocused(target: EventTarget | null): FocusedElement {
    if (!(target instanceof HTMLElement))
        return { tagName: "", type: "", isContentEditable: false };
    return {
        tagName: target.tagName,
        type: target instanceof HTMLInputElement ? target.type : "",
        isContentEditable: target.isContentEditable,
    };
}
