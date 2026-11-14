import { NavLink } from "react-router";
import { toHref } from "../app/token-path";
import {
    type DeprecationView,
    type DescriptionView,
    createDeprecationEdit,
    createDescriptionEdit,
} from "../controllers/properties";
import { useStudio } from "../providers/studio-context";
import { useDraft } from "./use-draft";
import { useEdit } from "./use-edit";

export function DeprecatedLine({ line }: { line: NonNullable<DeprecationView["notice"]> }) {
    return (
        <p>
            Deprecated
            {line.group && (
                <>
                    {" "}
                    by <NavLink to={toHref(line.group)}>{line.group}</NavLink>
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
                            const { result, options } = createDescriptionEdit(
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
                {view.from !== undefined && (
                    <>
                        {" "}
                        From <NavLink to={toHref(view.from)}>{view.from}</NavLink>
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
    box: NonNullable<DeprecationView["checkbox"]>;
}) {
    const studio = useStudio();
    const edit = useEdit();
    const [text, setText] = useDraft(box.message, box.message);
    const write = (checked: boolean, reason: string) => {
        const { result, options } = createDeprecationEdit(
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
