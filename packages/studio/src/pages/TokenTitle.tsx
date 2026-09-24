"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { joinTokenPath, parentPath, tokenPathSegments } from "../tokens/paths";

type Props = {
    path: string;
    onRename?: (nextPath: string) => void;
};

export function TokenTitle({ path, onRename }: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const field = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const element = field.current;
        if (!editing || !element) return;
        element.focus();
        element.select();
    }, [editing]);

    const segments = tokenPathSegments(path);
    const name = segments.at(-1);
    const prefix = segments.slice(0, -1);

    if (!name) return null;
    const current = name;

    const lead = prefix.map((segment) => (
        <Fragment key={segment.path}>
            <span className={`token-title-${segment.role}`}>{segment.text}</span>
            <span className="token-title-dot">.</span>
        </Fragment>
    ));

    function open() {
        setDraft(current.text);
        setEditing(true);
    }

    function commit() {
        setEditing(false);
        const next = joinTokenPath(parentPath(path), draft);
        if (next && next !== path) onRename?.(next);
    }

    function keyDown(event: React.KeyboardEvent) {
        if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
        }
        if (event.key === "Enter") {
            event.preventDefault();
            commit();
        }
    }

    const label = <span className={`token-title-${name.role}`}>{name.text}</span>;

    return (
        <h1 className="token-title">
            {lead}
            {editing ? (
                <input
                    ref={field}
                    type="text"
                    className="token-title-field"
                    value={draft}
                    size={Math.max(draft.length, 1)}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={keyDown}
                    aria-label={`Name for ${path}`}
                />
            ) : onRename ? (
                <button type="button" className="token-title-trigger" onClick={open}>
                    {label}
                </button>
            ) : (
                label
            )}
        </h1>
    );
}
