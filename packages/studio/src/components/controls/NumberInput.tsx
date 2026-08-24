"use client";

import { useEffect, useState } from "react";
import { useFieldRow } from "../../shell/Field";

type NumberInputProps = {
    "value": number | undefined;
    "onChange": (value: number) => void;
    "min"?: number;
    "max"?: number;
    "step"?: number;
    "unit"?: string;
    "id"?: string;
    "disabled"?: boolean;
    "aria-label"?: string;
};

function asText(value: number | undefined) {
    return value === undefined ? "" : String(value);
}

function clamp(value: number, min?: number, max?: number) {
    let next = value;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return next;
}

function NumberInput({
    value,
    onChange,
    min,
    max,
    step,
    unit,
    id,
    disabled,
    "aria-label": ariaLabel,
}: NumberInputProps) {
    const row = useFieldRow();
    const [text, setText] = useState(() => asText(value));
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (!editing) setText(asText(value));
    }, [value, editing]);

    function commit() {
        const parsed = Number.parseFloat(text);
        if (Number.isNaN(parsed)) {
            setText(asText(value));
            return;
        }
        const next = clamp(parsed, min, max);
        setText(String(next));
        if (next !== value) onChange(next);
    }

    return (
        <div data-slot="number-input" className="number-input">
            <input
                id={id ?? row?.id}
                type="number"
                className="number-input-field"
                aria-label={ariaLabel}
                value={text}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onChange={(event) => setText(event.target.value)}
                onFocus={() => setEditing(true)}
                onBlur={() => {
                    setEditing(false);
                    commit();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") commit();
                    if (event.key === "Escape") setText(asText(value));
                }}
            />
            {unit ? (
                <span data-slot="number-input-unit" className="number-input-unit">
                    {unit}
                </span>
            ) : null}
        </div>
    );
}

export { NumberInput };
export type { NumberInputProps };
