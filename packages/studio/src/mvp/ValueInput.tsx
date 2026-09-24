import { useState } from "react";
import { readField, writeField } from "./value-field";

type Props = {
    type: string | undefined;
    value: unknown;
    label: string;
    onWrite: (next: unknown) => void;
};

export function ValueInput({ type, value, label, onWrite }: Props) {
    const field = readField(type, value);
    const [draft, setDraft] = useState(field.text);
    const [seen, setSeen] = useState(field.text);

    if (field.text !== seen) {
        setSeen(field.text);
        setDraft(field.text);
    }

    if (!field.editable) return <span>{field.text}</span>;

    if (field.choices) {
        return (
            <select
                value={field.text}
                aria-label={label}
                onChange={(event) => {
                    const next = writeField(type, value, event.target.value);
                    if (next !== undefined) onWrite(next);
                }}
            >
                {field.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                        {choice.label}
                    </option>
                ))}
            </select>
        );
    }

    const commit = () => {
        if (draft === field.text) return;
        const next = writeField(type, value, draft);
        if (next === undefined) setDraft(field.text);
        else onWrite(next);
    };

    return (
        <input
            type="text"
            value={draft}
            aria-label={label}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setDraft(field.text);
            }}
        />
    );
}
