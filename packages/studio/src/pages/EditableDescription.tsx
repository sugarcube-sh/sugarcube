"use client";

import { useEffect, useRef, useState } from "react";
import { useDescription } from "../store/hooks";

export function EditableDescription({ path }: { path: string }) {
    const [description, setDescription] = useDescription(path);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const field = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const element = field.current;
        if (!editing || !element) return;
        element.focus();
        element.setSelectionRange(element.value.length, element.value.length);
    }, [editing]);

    function open() {
        setDraft(description ?? "");
        setEditing(true);
    }

    function commit() {
        setEditing(false);
        if (draft !== (description ?? "")) setDescription(draft);
    }

    function keyDown(event: React.KeyboardEvent) {
        if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
        }
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
        }
    }

    if (editing) {
        return (
            <textarea
                ref={field}
                className="page-lede description-field"
                value={draft}
                rows={Math.max(2, draft.split("\n").length)}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={keyDown}
                aria-label={`Description for ${path}`}
            />
        );
    }

    return (
        <button type="button" className="page-lede description-trigger" onClick={open}>
            {description ?? <span className="text-quiet">Add a description</span>}
        </button>
    );
}
