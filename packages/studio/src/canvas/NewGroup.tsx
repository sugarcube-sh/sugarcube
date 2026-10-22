import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { hrefFor } from "../app/token-path";
import { canAddGroup, newGroupEdit } from "../controllers/actions";
import { useStudio } from "../providers/studio-context";
import { useEdit } from "./use-edit";

export function NewGroup({ parent }: { parent: string }) {
    const studio = useStudio();
    const edit = useEdit();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const heading = useId();

    return (
        <form
            aria-labelledby={heading}
            onSubmit={(event) => {
                event.preventDefault();
                const made = newGroupEdit(studio.state.tokens, parent, name);
                if (edit.run(made.result, made.options)) navigate(hrefFor(made.path));
            }}
        >
            <h2 id={heading}>New group</h2>
            <label>
                Name <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>{" "}
            <button type="submit" disabled={!canAddGroup(name)}>
                Add
            </button>
            {edit.view}
        </form>
    );
}
