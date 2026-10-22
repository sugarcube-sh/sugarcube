import { useEffect } from "react";
import { type Focused, changeBarActions, undoFor } from "../controllers/undo";
import { useStudio } from "../providers/studio-context";

export function useUndoKeys(): void {
    const studio = useStudio();

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const action = undoFor(event, focusedOf(event.target), changeBarActions(studio));
            if (!action) return;
            event.preventDefault();
            studio[action]();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [studio]);
}

function focusedOf(target: EventTarget | null): Focused {
    if (!(target instanceof HTMLElement))
        return { tagName: "", type: "", isContentEditable: false };
    return {
        tagName: target.tagName,
        type: target instanceof HTMLInputElement ? target.type : "",
        isContentEditable: target.isContentEditable,
    };
}
