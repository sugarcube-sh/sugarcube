import { NavLink } from "react-router";
import { hrefFor } from "../app/token-path";
import {
    type DeprecationView,
    type DescriptionView,
    deprecationEdit,
    descriptionEdit,
} from "../controllers/properties";
import { useStudio } from "../providers/studio-context";
import { useDraft } from "./use-draft";
import { useEdit } from "./use-edit";

export function DeprecatedLine({ line }: { line: NonNullable<DeprecationView["line"]> }) {
    return (
        <p>
            Deprecated
            {line.by && (
                <>
                    {" "}
                    by <NavLink to={hrefFor(line.by)}>{line.by}</NavLink>
                </>
            )}
            {line.message && `: ${line.message}`}.
        </p>
    );
}

export function DescriptionRow({ path, view }: { path: string; view: DescriptionView }) {
    const studio = useStudio();
    const edit = useEdit();
    const [text, setText] = useDraft(view.text, view.text);

    return (
        <>
            <dt>Description</dt>
            <dd>
                {view.editable ? (
                    <textarea
                        aria-label="Description"
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            const { result, options } = descriptionEdit(
                                studio.state.tokens,
                                path,
                                event.target.value,
                            );
                            edit.run(result, options);
                        }}
                    />
                ) : (
                    view.text
                )}
                {view.from && (
                    <>
                        {" "}
                        From <NavLink to={hrefFor(view.from)}>{view.from}</NavLink>
                    </>
                )}
                {edit.view}
            </dd>
        </>
    );
}

export function DeprecationRow({
    path,
    box,
}: {
    path: string;
    box: NonNullable<DeprecationView["box"]>;
}) {
    const studio = useStudio();
    const edit = useEdit();
    const [text, setText] = useDraft(box.message, box.message);
    const write = (checked: boolean, reason: string) => {
        const { result, options } = deprecationEdit(
            studio.state.tokens,
            path,
            box,
            checked,
            reason,
        );
        edit.run(result, options);
    };

    return (
        <>
            <dt>Deprecated</dt>
            <dd>
                <input
                    type="checkbox"
                    aria-label="Deprecated"
                    checked={box.checked}
                    onChange={(event) => write(event.target.checked, text)}
                />
                {box.checked && (
                    <label>
                        {" "}
                        Reason{" "}
                        <input
                            placeholder="Optional"
                            value={text}
                            onChange={(event) => {
                                setText(event.target.value);
                                write(true, event.target.value);
                            }}
                        />
                    </label>
                )}
                {edit.view}
            </dd>
        </>
    );
}
