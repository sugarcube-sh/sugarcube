import type { JsonPath, JsonValue } from "@sugarcube-sh/dtcg";
import { lineCaps, strokeStyleKeywords } from "@sugarcube-sh/dtcg/values";
import {
    type FieldWithParts,
    type FieldPart,
    type Slot,
    addFieldItem,
    removeFieldItem,
} from "../controllers/parts";
import { Select } from "./Select";
import { JsonField } from "./JsonField";
import { TypedField } from "./TypedField";
import { useItemKeys } from "./use-draft";

type WriteHandler = (value: JsonValue, part?: JsonPath, control?: string) => void;

const itemLabelByType = { shadow: "Layer", gradient: "Stop" } as const;

export function CompositeInput({
    field,
    label,
    onWrite,
}: {
    field: FieldWithParts;
    label: string;
    onWrite: WriteHandler;
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

function prefixPath(path: JsonPath, onWrite: WriteHandler): WriteHandler {
    return (value, part = [], control) => onWrite(value, [...path, ...part], control);
}

function Parts({
    parts,
    label,
    onWrite,
}: {
    parts: readonly FieldPart[];
    label: string;
    onWrite: WriteHandler;
}) {
    return (
        <fieldset aria-label={label}>
            {parts.map((part) => (
                <div key={part.name}>
                    {part.name}{" "}
                    <SlotField
                        slot={part}
                        label={`${label}, ${part.name}`}
                        onWrite={prefixPath(part.part, onWrite)}
                    />
                </div>
            ))}
        </fieldset>
    );
}

function SlotField({ slot, label, onWrite }: { slot: Slot; label: string; onWrite: WriteHandler }) {
    if (slot.type === "boolean") {
        return (
            <input
                type="checkbox"
                aria-label={label}
                checked={slot.value === true}
                onChange={(event) => onWrite(event.target.checked)}
            />
        );
    }
    return <TypedField type={slot.type} value={slot.value} label={label} onWrite={onWrite} />;
}

function List({
    field,
    label,
    onWrite,
}: {
    field: Extract<FieldWithParts, { kind: "list" }>;
    label: string;
    onWrite: WriteHandler;
}) {
    const keys = useItemKeys(field.items.length);
    const name = itemLabelByType[field.type];

    return (
        <ol aria-label={label}>
            {field.items.map((item, index) => {
                const itemLabel = `${label}, ${name.toLowerCase()} ${index + 1}`;
                const write = prefixPath(item.part, onWrite);
                return (
                    <li key={keys.keys[index]}>
                        {name} {index + 1}{" "}
                        {item.display === "parts" ? (
                            <Parts parts={item.parts} label={itemLabel} onWrite={write} />
                        ) : item.display === "reference" ? (
                            <TypedField
                                type={field.type}
                                value={item.value}
                                label={itemLabel}
                                onWrite={write}
                            />
                        ) : (
                            <JsonField value={item.value} label={itemLabel} onWrite={write} />
                        )}
                        <button
                            type="button"
                            disabled={field.items.length === 1}
                            onClick={() => {
                                keys.remove(index);
                                onWrite(removeFieldItem(field, index));
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
                        keys.add();
                        onWrite(addFieldItem(field));
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
    onWrite: WriteHandler;
}) {
    const keys = useItemKeys(field.dashes.length);

    return (
        <>
            <Select
                label={label}
                value="dashes"
                options={[...strokeStyleKeywords, "dashes"]}
                optionLabels={{ dashes: "Dashes" }}
                onChange={(choice) => {
                    if (choice !== "dashes") onWrite(choice);
                }}
            />
            <ol aria-label={`${label}, dashes`}>
                {field.dashes.map((dash, index) => (
                    <li key={keys.keys[index]}>
                        <SlotField
                            slot={dash}
                            label={`${label}, dash ${index + 1}`}
                            onWrite={prefixPath(dash.part, onWrite)}
                        />{" "}
                        <button
                            type="button"
                            disabled={field.dashes.length === 1}
                            onClick={() => {
                                keys.remove(index);
                                onWrite(removeFieldItem(field, index));
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
                            keys.add();
                            onWrite(addFieldItem(field));
                        }}
                    >
                        Add dash
                    </button>
                </li>
            </ol>
            <Select
                label={`${label}, line cap`}
                value={field.lineCap}
                options={lineCaps}
                onChange={(lineCap) => onWrite(lineCap, ["lineCap"])}
            />
        </>
    );
}
