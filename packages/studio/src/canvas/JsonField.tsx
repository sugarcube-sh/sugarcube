import type { JsonValue } from "@sugarcube-sh/dtcg";
import { parseJSON } from "../controllers/typed-text";
import { isChanged } from "../controllers/value-field";
import { JsonInput } from "./JsonInput";
import { useDraft } from "./use-draft";

export function JsonField({
    value,
    label,
    onWrite,
}: {
    value: JsonValue | undefined;
    label: string;
    onWrite(value: JsonValue): void;
}) {
    const valueText = value === undefined ? "" : JSON.stringify(value);
    const [text, setText] = useDraft(valueText, valueText, (draftText) => {
        const parsed = parseJSON(draftText);
        return parsed !== undefined && !isChanged({ kind: "json", value: parsed.value }, value);
    });

    const write = () => {
        const parsed = parseJSON(text);
        if (parsed && isChanged({ kind: "json", value: parsed.value }, value))
            onWrite(parsed.value);
    };

    return (
        <JsonInput
            aria-label={label}
            text={text}
            onText={setText}
            onBlur={write}
            onKeyDown={(event) => {
                if (event.key === "Enter") write();
            }}
        />
    );
}
