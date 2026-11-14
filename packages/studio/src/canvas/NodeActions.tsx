import { useState } from "react";
import { tokenPath } from "@sugarcube-sh/dtcg";
import { type Removal, createRemoval, createRenameEdit } from "../controllers/actions";
import { useStudio } from "../providers/studio-context";
import { useDraft } from "./use-draft";
import { useEdit } from "./use-edit";

export function NodeActions({ path }: { path: string }) {
    const studio = useStudio();
    const edit = useEdit();
    const [name, setName] = useDraft(tokenPath.getName(path), path);
    const [pendingRemoval, setPendingRemoval] = useState<Extract<Removal, { kind: "confirm" }>>();

    return (
        <>
            <form
                aria-label="Rename"
                onSubmit={(event) => {
                    event.preventDefault();
                    const { result, options } = createRenameEdit(studio.state.tokens, path, name);
                    edit.run(result, options);
                }}
            >
                <label>
                    Name <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>{" "}
                <button type="submit">Rename</button>
            </form>
            {pendingRemoval ? (
                <p>
                    Breaks{" "}
                    {pendingRemoval.pathsWithBrokenReferences.map((each, index) => (
                        <span key={each}>
                            {index > 0 && ", "}
                            <code>{each}</code>
                        </span>
                    ))}
                    .{" "}
                    <button
                        type="button"
                        onClick={() =>
                            edit.run(pendingRemoval.edit.result, pendingRemoval.edit.options)
                        }
                    >
                        Remove anyway
                    </button>{" "}
                    <button type="button" onClick={() => setPendingRemoval(undefined)}>
                        Cancel
                    </button>
                </p>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        const removalResult = createRemoval(studio.state.tokens, path);
                        if (removalResult.kind === "confirm") setPendingRemoval(removalResult);
                        else edit.run(removalResult.edit.result, removalResult.edit.options);
                    }}
                >
                    Remove
                </button>
            )}
            {edit.view}
        </>
    );
}
