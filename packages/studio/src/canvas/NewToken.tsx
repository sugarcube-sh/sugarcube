import { type Group, type JsonValue, type TokenType, childPath } from "@sugarcube-sh/dtcg";
import { tokenTypes } from "@sugarcube-sh/dtcg/values";
import { useId, useState } from "react";
import { canAddToken, newTokenEdit } from "../controllers/actions";
import { hasField } from "../controllers/value-field";
import { useStudio } from "../providers/studio-context";
import { JsonInput } from "./JsonInput";
import { EditedTokenContext } from "../providers/edited-token-context";
import { TypedField } from "./TypedField";
import { useEdit } from "./use-edit";

export function NewToken({ group }: { group: Group }) {
    const studio = useStudio();
    const edit = useEdit();
    const [name, setName] = useState("");
    const [type, setType] = useState<TokenType>(group.type ?? "color");
    const [value, setValue] = useState<JsonValue>();
    const [text, setText] = useState("");
    const valueId = useId();
    const heading = useId();
    const path = childPath(group.path, name);

    return (
        <form
            aria-labelledby={heading}
            onSubmit={(event) => {
                event.preventDefault();
                if (value === undefined) return;
                const { result, options } = newTokenEdit(studio.state.tokens, group, name, {
                    type,
                    value,
                });
                if (edit.run(result, options)) {
                    setName("");
                    setValue(undefined);
                    setText("");
                }
            }}
        >
            <h2 id={heading}>New token</h2>
            <label>
                Name <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>{" "}
            <label>
                Type{" "}
                <select
                    value={type}
                    onChange={(event) => {
                        setType(tokenTypes.find((each) => each === event.target.value) ?? type);
                        setValue(undefined);
                        setText("");
                    }}
                >
                    {tokenTypes.map((each) => (
                        <option key={each} value={each}>
                            {each}
                        </option>
                    ))}
                </select>
            </label>{" "}
            {hasField(type) ? (
                <EditedTokenContext.Provider value={path}>
                    <TypedField
                        key={type}
                        type={type}
                        written={value}
                        label="Value"
                        onWrite={setValue}
                    />
                </EditedTokenContext.Provider>
            ) : (
                <>
                    <label htmlFor={valueId}>Value</label>{" "}
                    <JsonInput
                        id={valueId}
                        text={text}
                        onText={(next, parsed) => {
                            setText(next);
                            setValue(parsed?.value);
                        }}
                    />
                </>
            )}{" "}
            <button type="submit" disabled={!canAddToken(name, value)}>
                Add
            </button>
            {edit.view}
        </form>
    );
}
