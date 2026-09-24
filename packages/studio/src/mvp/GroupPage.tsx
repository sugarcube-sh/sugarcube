import { type FormEvent, useState } from "react";
import { NavLink } from "react-router";
import { hrefFor } from "../app/token-path";
import { useCurrentContext, usePathIndex, useSetCurrentContext } from "../store/hooks";
import type { Handle } from "../tokens/path-index";
import { NameInput, NodeHeading } from "./NameInput";
import { ProblemMarker } from "./Problems";
import { ValueInput } from "./ValueInput";
import { type TokenRow, fileName, overrideFiles } from "./token-view";
import {
    useBaseContext,
    useCreateGroup,
    useCreateToken,
    useGroupView,
    usePlacement,
    usePreviewValue,
    useRemoveNode,
    useRowWritable,
    useSiblingType,
    useWriteBase,
} from "./use-group";
import { DTCG_TYPES, readField } from "./value-field";

export function GroupPage({ handle }: { handle: Handle }) {
    const view = useGroupView(handle);
    const base = useBaseContext();
    const context = useCurrentContext();
    const remove = useRemoveNode();

    if (!view) return <p>Nothing at this address.</p>;

    return (
        <article>
            <NodeHeading handle={view.handle} path={view.path} editable={context === base} />
            {view.description && <p>{view.description}</p>}

            <ContextPreview base={base} />

            {view.groups.length > 0 && (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Group</th>
                            <th scope="col">Tokens</th>
                        </tr>
                    </thead>
                    <tbody>
                        {view.groups.map((row) => (
                            <tr key={row.handle}>
                                <th scope="row">
                                    {context === base ? (
                                        <NameInput handle={row.handle} path={row.path} />
                                    ) : (
                                        row.name
                                    )}
                                    <NavLink to={hrefFor(row.path)} end>
                                        open
                                    </NavLink>
                                </th>
                                <td>
                                    {row.count}
                                    {context === base && (
                                        <button type="button" onClick={() => remove(row.handle)}>
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {view.tokens.length === 0 ? (
                <p>
                    {view.groups.length > 0
                        ? "No tokens directly in this group."
                        : "This group has no tokens."}
                </p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {view.tokens.map((row) => (
                            <Row key={row.handle} row={row} base={base} context={context} />
                        ))}
                    </tbody>
                </table>
            )}

            {context === base && (
                <>
                    <NewToken parent={view.handle} />
                    <NewGroup parent={view.handle} />
                </>
            )}
        </article>
    );
}

function NewToken({ parent }: { parent: Handle }) {
    const placement = usePlacement(parent);
    const inherited = useSiblingType(parent);
    const create = useCreateToken();

    const [name, setName] = useState("");
    const [type, setType] = useState(inherited ?? "color");
    const [file, setFile] = useState("");

    if (placement.kind === "none") return null;

    const candidates = placement.kind === "ask" ? placement.candidates : [];
    const sourcePath = placement.kind === "settled" ? placement.sourcePath : file || candidates[0];

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim() || !sourcePath) return;
        if (create({ parent, name: name.trim(), type, sourcePath })) setName("");
    };

    return (
        <form onSubmit={submit}>
            <h2>New token</h2>

            <label>
                Name <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label>
                Type{" "}
                <select value={type} onChange={(e) => setType(e.target.value)}>
                    {DTCG_TYPES.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>

            {placement.kind === "ask" && (
                <label>
                    File{" "}
                    <select value={sourcePath} onChange={(e) => setFile(e.target.value)}>
                        {candidates.map((path) => (
                            <option key={path} value={path}>
                                {fileName(path)}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            <button type="submit" disabled={!name.trim()}>
                Add
            </button>
        </form>
    );
}

function NewGroup({ parent }: { parent: Handle }) {
    const placement = usePlacement(parent);
    const create = useCreateGroup();

    const [name, setName] = useState("");
    const [file, setFile] = useState("");

    if (placement.kind === "none") return null;

    const candidates = placement.kind === "ask" ? placement.candidates : [];
    const sourcePath = placement.kind === "settled" ? placement.sourcePath : file || candidates[0];

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim() || !sourcePath) return;
        if (create({ parent, name: name.trim(), sourcePath })) setName("");
    };

    return (
        <form onSubmit={submit}>
            <h2>New group</h2>

            <label>
                Name <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            {placement.kind === "ask" && (
                <label>
                    File{" "}
                    <select value={sourcePath} onChange={(e) => setFile(e.target.value)}>
                        {candidates.map((path) => (
                            <option key={path} value={path}>
                                {fileName(path)}
                            </option>
                        ))}
                    </select>
                </label>
            )}

            <button type="submit" disabled={!name.trim()}>
                Add
            </button>

            <p>The group is written to the file now, empty.</p>
        </form>
    );
}

function ContextPreview({ base }: { base: string }) {
    const index = usePathIndex();
    const context = useCurrentContext();
    const setContext = useSetCurrentContext();
    const contexts = index.contexts;

    if (contexts.length < 2) return null;

    return (
        <p>
            <label>
                Previewing{" "}
                <select value={context} onChange={(event) => setContext(event.target.value)}>
                    {contexts.map((name) => (
                        <option key={name} value={name}>
                            {name === base ? `${name} (document)` : name}
                        </option>
                    ))}
                </select>
            </label>{" "}
            {context !== base && "Values read only. Switch back to the document to edit."}
        </p>
    );
}

function Row({ row, base, context }: { row: TokenRow; base: string; context: string }) {
    const previewing = context !== base;
    const files = overrideFiles(row);
    const remove = useRemoveNode();

    return (
        <tr>
            <th scope="row">
                {previewing ? (
                    <NavLink to={hrefFor(row.path)} end>
                        {row.name}
                    </NavLink>
                ) : (
                    <NameCell row={row} />
                )}
            </th>
            <td>
                {previewing ? <PreviewCell row={row} context={context} /> : <BaseCell row={row} />}
                {files.length > 0 && <small> overridden in {files.join(", ")}</small>}
                <ProblemMarker handle={row.handle} />
                {!previewing && (
                    <button type="button" onClick={() => remove(row.handle)}>
                        Delete
                    </button>
                )}
            </td>
        </tr>
    );
}

function NameCell({ row }: { row: TokenRow }) {
    return (
        <>
            <NameInput handle={row.handle} path={row.path} />
            <NavLink to={hrefFor(row.path)} end>
                open
            </NavLink>
        </>
    );
}

function PreviewCell({ row, context }: { row: TokenRow; context: string }) {
    const value = usePreviewValue(row.handle, context);
    const field = readField(row.type, value);
    return <span>{field.text || "not declared here"}</span>;
}

function BaseCell({ row }: { row: TokenRow }) {
    const write = useWriteBase();
    const writable = useRowWritable(row);

    if (row.value === undefined) return <span>not declared in the document</span>;
    if (!writable) return <span>{readField(row.type, row.value).text}</span>;

    return (
        <ValueInput
            type={row.type}
            value={row.value}
            label={`${row.path} value`}
            onWrite={(next) => write(row, next)}
        />
    );
}
