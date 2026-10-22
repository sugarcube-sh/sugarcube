import type { Group, JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { create } from "@sugarcube-sh/dtcg-edit";
import { tokenTypes } from "@sugarcube-sh/dtcg/values";
import { useId, useState } from "react";
import { newToken } from "../controllers/token-page";
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
    const path = `${group.path}.${name}`;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (value === undefined) return;
                const made = edit.run(
                    create(studio.state.tokens, path, newToken({ type, value }, group)),
                );
                if (made) {
                    setName("");
                    setValue(undefined);
                    setText("");
                }
            }}
        >
            <h2>New token</h2>
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
            <button type="submit" disabled={name === "" || value === undefined}>
                Add
            </button>
            {edit.view}
        </form>
    );
}
