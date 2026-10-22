import { useState } from "react";
import { type Removal, nameOf, removal, renameEdit } from "../controllers/actions";
import { useStudio } from "../providers/studio-context";
import { useDraft } from "./use-draft";
import { useEdit } from "./use-edit";

export function NodeActions({ path }: { path: string }) {
    const studio = useStudio();
    const edit = useEdit();
    const [name, setName] = useDraft(nameOf(path), path);
    const [breaking, setBreaking] = useState<Extract<Removal, { kind: "asks" }>>();

    return (
        <>
            <form
                aria-label="Rename"
                onSubmit={(event) => {
                    event.preventDefault();
                    const { result, options } = renameEdit(studio.state.tokens, path, name);
                    edit.run(result, options);
                }}
            >
                <label>
                    Name <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>{" "}
                <button type="submit">Rename</button>
            </form>
            {breaking ? (
                <p>
                    Breaks{" "}
                    {breaking.breaks.map((each, index) => (
                        <span key={each}>
                            {index > 0 && ", "}
                            <code>{each}</code>
                        </span>
                    ))}
                    .{" "}
                    <button
                        type="button"
                        onClick={() => edit.run(breaking.edit.result, breaking.edit.options)}
                    >
                        Remove anyway
                    </button>{" "}
                    <button type="button" onClick={() => setBreaking(undefined)}>
                        Cancel
                    </button>
                </p>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        const asked = removal(studio.state.tokens, path);
                        if (asked.kind === "asks") setBreaking(asked);
                        else edit.run(asked.edit.result, asked.edit.options);
                    }}
                >
                    Remove
                </button>
            )}
            {edit.view}
        </>
    );
}
