"use client";

import { useState } from "react";
import { useFieldRow } from "../../inspector/Field";

type TextInputProps = {
    "value": string | undefined;
    "onChange": (value: string) => void;
    "placeholder"?: string;
    "id"?: string;
    "disabled"?: boolean;
    "aria-label"?: string;
};

function TextInput({
    value,
    onChange,
    placeholder,
    id,
    disabled,
    "aria-label": ariaLabel,
}: TextInputProps) {
    const row = useFieldRow();
    const [text, setText] = useState(value ?? "");
    const [editing, setEditing] = useState(false);

    const [synced, setSynced] = useState({ value, editing });
    if (synced.value !== value || synced.editing !== editing) {
        setSynced({ value, editing });
        if (!editing) setText(value ?? "");
    }

    function commit() {
        if (text !== value) onChange(text);
    }

    return (
        <div data-slot="text-input" className="text-input">
            <input
                id={id ?? row?.id}
                type="text"
                className="text-input-field"
                aria-label={ariaLabel}
                placeholder={placeholder}
                value={text}
                disabled={disabled}
                onChange={(event) => setText(event.target.value)}
                onFocus={() => setEditing(true)}
                onBlur={() => {
                    setEditing(false);
                    commit();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") commit();
                    if (event.key === "Escape") setText(value ?? "");
                }}
            />
        </div>
    );
}

export { TextInput };
export type { TextInputProps };
