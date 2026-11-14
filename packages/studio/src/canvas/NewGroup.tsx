import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { toHref } from "../app/token-path";
import { canAddGroup, createGroupEdit } from "../controllers/actions";
import { useStudio } from "../providers/studio-context";
import { useEdit } from "./use-edit";

export function NewGroup({ parent }: { parent: string }) {
    const studio = useStudio();
    const edit = useEdit();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const headingID = useId();

    return (
        <form
            aria-labelledby={headingID}
            onSubmit={(event) => {
                event.preventDefault();
                const groupEdit = createGroupEdit(studio.state.tokens, parent, name);
                if (edit.run(groupEdit.result, groupEdit.options)) navigate(toHref(groupEdit.path));
            }}
        >
            <h2 id={headingID}>New group</h2>
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
