import type { JsonPath, JsonValue } from "@sugarcube-sh/dtcg";
import { lineCaps, strokeStyleKeywords } from "@sugarcube-sh/dtcg/values";
import {
    type FieldWithParts,
    type FieldPart,
    type Slot,
    withAdded,
    withRemoved,
} from "../controllers/parts";
import { Choice } from "./Choice";
import { JsonField } from "./JsonField";
import { TypedField } from "./TypedField";
import { useItemKeys } from "./use-draft";

type Write = (value: JsonValue, part?: JsonPath, control?: string) => void;

const itemNames = { shadow: "Layer", gradient: "Stop" } as const;

export function CompositeInput({
    field,
    label,
    onWrite,
}: {
    field: FieldWithParts;
    label: string;
    onWrite: Write;
}) {
    switch (field.kind) {
        case "parts":
            return <Parts parts={field.parts} label={label} onWrite={onWrite} />;
        case "list":
            return <List field={field} label={label} onWrite={onWrite} />;
        case "dashes":
            return <Dashes field={field} label={label} onWrite={onWrite} />;
    }
}

function within(at: JsonPath, onWrite: Write): Write {
    return (value, part = [], control) => onWrite(value, [...at, ...part], control);
}

function Parts({
    parts,
    label,
    onWrite,
}: {
    parts: readonly FieldPart[];
    label: string;
    onWrite: Write;
}) {
    return (
        <fieldset aria-label={label}>
            {parts.map((part) => (
                <div key={part.name}>
                    {part.name}{" "}
                    <SlotField
                        slot={part}
                        label={`${label}, ${part.name}`}
                        onWrite={within(part.at, onWrite)}
                    />
                </div>
            ))}
        </fieldset>
    );
}

function SlotField({ slot, label, onWrite }: { slot: Slot; label: string; onWrite: Write }) {
    if (slot.type === "boolean") {
        return (
            <input
                type="checkbox"
                aria-label={label}
                checked={slot.written === true}
                onChange={(event) => onWrite(event.target.checked)}
            />
        );
    }
    return <TypedField type={slot.type} written={slot.written} label={label} onWrite={onWrite} />;
}

function List({
    field,
    label,
    onWrite,
}: {
    field: Extract<FieldWithParts, { kind: "list" }>;
    label: string;
    onWrite: Write;
}) {
    const keys = useItemKeys(field.items.length);
    const name = itemNames[field.type];

    return (
        <ol aria-label={label}>
            {field.items.map((item, index) => {
                const here = `${label}, ${name.toLowerCase()} ${index + 1}`;
                const write = within(item.at, onWrite);
                return (
                    <li key={keys.keys[index]}>
                        {name} {index + 1}{" "}
                        {item.shown === "parts" ? (
                            <Parts parts={item.parts} label={here} onWrite={write} />
                        ) : item.shown === "reference" ? (
                            <TypedField
                                type={field.type}
                                written={item.written}
                                label={here}
                                onWrite={write}
                            />
                        ) : (
                            <JsonField written={item.written} label={here} onWrite={write} />
                        )}
                        <button
                            type="button"
                            disabled={field.items.length === 1}
                            onClick={() => {
                                keys.removed(index);
                                onWrite(withRemoved(field, index));
                            }}
                        >
                            Remove
                        </button>
                    </li>
                );
            })}
            <li>
                <button
                    type="button"
                    onClick={() => {
                        keys.added();
                        onWrite(withAdded(field));
                    }}
                >
                    Add {name.toLowerCase()}
                </button>
            </li>
        </ol>
    );
}

function Dashes({
    field,
    label,
    onWrite,
}: {
    field: Extract<FieldWithParts, { kind: "dashes" }>;
    label: string;
    onWrite: Write;
}) {
    const keys = useItemKeys(field.dashes.length);

    return (
        <>
            <Choice
                label={label}
                chosen="dashes"
                choices={[...strokeStyleKeywords, "dashes"]}
                names={{ dashes: "Dashes" }}
                onChoose={(choice) => {
                    if (choice !== "dashes") onWrite(choice);
                }}
            />
            <ol aria-label={`${label}, dashes`}>
                {field.dashes.map((dash, index) => (
                    <li key={keys.keys[index]}>
                        <SlotField
                            slot={dash}
                            label={`${label}, dash ${index + 1}`}
                            onWrite={within(dash.at, onWrite)}
                        />{" "}
                        <button
                            type="button"
                            disabled={field.dashes.length === 1}
                            onClick={() => {
                                keys.removed(index);
                                onWrite(withRemoved(field, index));
                            }}
                        >
                            Remove
                        </button>
                    </li>
                ))}
                <li>
                    <button
                        type="button"
                        onClick={() => {
                            keys.added();
                            onWrite(withAdded(field));
                        }}
                    >
                        Add dash
                    </button>
                </li>
            </ol>
            <Choice
                label={`${label}, line cap`}
                chosen={field.lineCap}
                choices={lineCaps}
                onChoose={(lineCap) => onWrite(lineCap, ["lineCap"])}
            />
        </>
    );
}
