import type { JsonValue } from "@sugarcube-sh/dtcg";
import type { InputHTMLAttributes } from "react";
import { parseJSON } from "../controllers/typed-text";

export function JsonInput({
    text,
    onText,
    ...inputProps
}: {
    text: string;
    onText(text: string, parsed: { value: JsonValue } | undefined): void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
    return (
        <>
            <input
                {...inputProps}
                value={text}
                onChange={(event) => onText(event.target.value, parseJSON(event.target.value))}
            />
            {text !== "" && !parseJSON(text) && <span> Not valid JSON</span>}
        </>
    );
}
