import { useState } from "react";
import { useNavigate } from "react-router";
import { hrefFor } from "../app/token-path";
import type { Handle } from "../tokens/path-index";
import { lastSegment, parentPath } from "../tokens/paths";
import { useRenameNode } from "./use-group";

export function NameInput({
    handle,
    path,
    onRenamed,
}: {
    handle: Handle;
    path: string;
    onRenamed?: (path: string) => void;
}) {
    const rename = useRenameNode();
    const last = lastSegment(path);
    const [draft, setDraft] = useState(last);
    const [seen, setSeen] = useState(last);

    if (last !== seen) {
        setSeen(last);
        setDraft(last);
    }

    const commit = () => {
        const name = draft.trim();
        if (name === last) return;
        if (!name || !rename(handle, name)) {
            setDraft(last);
            return;
        }
        const parent = path.slice(0, path.length - last.length);
        onRenamed?.(`${parent}${name}`);
    };

    return (
        <input
            type="text"
            value={draft}
            aria-label={`${path} name`}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setDraft(last);
            }}
        />
    );
}

export function NodeHeading({
    handle,
    path,
    editable,
}: {
    handle: Handle;
    path: string;
    editable: boolean;
}) {
    const navigate = useNavigate();

    if (!editable) return <h1>{path}</h1>;

    const parent = parentPath(path);

    return (
        <h1>
            {parent && <span>{parent}.</span>}
            <NameInput
                handle={handle}
                path={path}
                onRenamed={(next) => navigate(hrefFor(next), { replace: true })}
            />
        </h1>
    );
}
