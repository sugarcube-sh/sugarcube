import type { JsonPath, JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { dimensionUnits, durationUnits, strokeStyleKeywords } from "@sugarcube-sh/dtcg/values";
import { useContext, useId, useMemo } from "react";
import {
    type Draft,
    type Field,
    type FieldType,
    isChanged,
    toDraft,
    parseField,
    parseDraft,
    hasField,
    isSameValue,
    weightKeywords,
    withPoint,
    toJsonValue,
} from "../controllers/value-field";
import { moveListItem, removeListItem } from "../controllers/lists";
import { hasParts } from "../controllers/parts";
import { getReferenceTargets } from "../controllers/views";
import { useStudioState } from "../providers/studio-context";
import { Select } from "./Select";
import { ColorInput } from "./ColorInput";
import { CompositeInput } from "./CompositeInput";
import { EditedTokenContext } from "../providers/edited-token-context";
import { JsonField } from "./JsonField";
import { useDraft, useItemKeys } from "./use-draft";

export function TypedField({
    type,
    value,
    label,
    references = true,
    onWrite,
}: {
    type: TokenType | undefined;
    value: JsonValue | undefined;
    label: string;
    references?: boolean;
    onWrite(value: JsonValue, part?: JsonPath, control?: string): void;
}) {
    const field = value === undefined ? undefined : parseField(type, value);
    const valueText = value === undefined ? "" : JSON.stringify(value);
    const [source, setSource] = useDraft<"value" | "token">(
        field?.kind === "reference" ? "token" : "value",
        valueText,
    );
    const radioName = useId();
    const write = (next: Field, control?: string) => {
        if (isChanged(next, value)) onWrite(toJsonValue(next), undefined, control);
    };

    if (type === undefined || field?.kind === "json") {
        return <JsonField value={value} label={label} onWrite={onWrite} />;
    }

    return (
        <>
            {references && (
                <fieldset aria-label={label}>
                    <label>
                        <input
                            type="radio"
                            name={radioName}
                            checked={source === "value"}
                            onChange={() => setSource("value")}
                        />{" "}
                        Value
                    </label>{" "}
                    <label>
                        <input
                            type="radio"
                            name={radioName}
                            checked={source === "token"}
                            onChange={() => setSource("token")}
                        />{" "}
                        Token
                    </label>
                </fieldset>
            )}
            {references && source === "token" ? (
                <TokenInput
                    type={type}
                    label={label}
                    referencePath={field?.kind === "reference" ? field.path : undefined}
                    onReferenceChange={(to) => write({ kind: "reference", path: to })}
                />
            ) : field && hasParts(field) ? (
                <CompositeInput field={field} label={label} onWrite={onWrite} />
            ) : hasField(type) ? (
                <ValueInput
                    type={type}
                    field={field?.kind === "reference" ? undefined : field}
                    label={label}
                    write={write}
                />
            ) : (
                <JsonField value={undefined} label={label} onWrite={onWrite} />
            )}
        </>
    );
}

function TokenInput({
    type,
    label,
    referencePath,
    onReferenceChange,
}: {
    type: TokenType;
    label: string;
    referencePath: string | undefined;
    onReferenceChange(path: string): void;
}) {
    const tokens = useStudioState((state) => state.tokens);
    const showing = useStudioState((state) => state.shownPermutation);
    const path = useContext(EditedTokenContext);
    const referencePaths = useMemo(
        () => getReferenceTargets(tokens, showing, type, path),
        [tokens, showing, type, path],
    );
    const [text, setText] = useDraft(referencePath ?? "", referencePath ?? "");
    const listID = useId();

    return (
        <>
            <input
                aria-label={`${label}, token`}
                list={listID}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    if (referencePaths.includes(event.target.value))
                        onReferenceChange(event.target.value);
                }}
            />
            <datalist id={listID}>
                {referencePaths.map((each) => (
                    <option key={each} value={each}>
                        {each}
                    </option>
                ))}
            </datalist>
        </>
    );
}

function ValueInput({
    type,
    field,
    label,
    write,
}: {
    type: FieldType;
    field: Field | undefined;
    label: string;
    write(field: Field, control?: string): void;
}) {
    const [draft, setDraft] = useDraft(
        toDraft(type, field),
        field ? JSON.stringify(field) : "",
        (currentDraft) => isSameValue(currentDraft, field),
    );
    const change = (next: Draft, control?: string) => {
        setDraft(next);
        const nextField = parseDraft(next);
        if (nextField) write(nextField, control);
    };

    switch (draft.kind) {
        case "dimension":
        case "duration":
            return (
                <>
                    <NumberInput
                        label={`${label}, amount`}
                        amount={draft.amount}
                        onAmount={(amount) => change({ ...draft, amount })}
                    />{" "}
                    <Select
                        label={`${label}, unit`}
                        value={draft.unit}
                        options={draft.kind === "dimension" ? dimensionUnits : durationUnits}
                        onChange={(unit) => change({ ...draft, unit })}
                    />
                </>
            );
        case "number":
            return (
                <NumberInput
                    label={label}
                    amount={draft.amount}
                    onAmount={(amount) => change({ ...draft, amount })}
                />
            );
        case "fontWeight":
            return (
                <>
                    <Select
                        label={label}
                        value={draft.choice}
                        options={[...weightKeywords, "number"]}
                        optionLabels={{ number: "Number" }}
                        onChange={(choice) => change({ ...draft, choice })}
                    />
                    {draft.choice === "number" && (
                        <>
                            {" "}
                            <NumberInput
                                label={`${label}, number`}
                                amount={draft.amount}
                                min={1}
                                max={1000}
                                onAmount={(amount) => change({ ...draft, amount })}
                            />
                        </>
                    )}
                </>
            );
        case "fontFamily":
            return (
                <FontList
                    label={label}
                    fonts={draft.fonts}
                    onFonts={(fonts) => change({ ...draft, fonts })}
                />
            );
        case "cubicBezier":
            return (
                <fieldset aria-label={label}>
                    {draft.points.map((amount, index) => (
                        <NumberInput
                            key={bezierPointLabels[index]}
                            label={`${label}, ${bezierPointLabels[index]}`}
                            amount={amount}
                            min={index % 2 === 0 ? 0 : undefined}
                            max={index % 2 === 0 ? 1 : undefined}
                            onAmount={(next) => change(withPoint(draft, index, next))}
                        />
                    ))}
                </fieldset>
            );
        case "strokeStyle":
            return (
                <Select
                    label={label}
                    value={draft.keyword}
                    options={strokeStyleKeywords}
                    onChange={(keyword) => change({ ...draft, keyword })}
                />
            );
        case "color":
        case "hexColor": {
            const currentField = parseDraft(draft) ?? field;
            return (
                <ColorInput
                    draft={draft}
                    color={currentField?.kind === "color" ? currentField : undefined}
                    label={label}
                    onDraft={change}
                />
            );
        }
    }
}

const bezierPointLabels = ["P1x", "P1y", "P2x", "P2y"] as const;

function NumberInput({
    label,
    amount,
    min,
    max,
    onAmount,
}: {
    label: string;
    amount: string;
    min?: number;
    max?: number;
    onAmount(amount: string): void;
}) {
    return (
        <input
            type="number"
            step="any"
            aria-label={label}
            min={min}
            max={max}
            value={amount}
            onChange={(event) => onAmount(event.target.value)}
        />
    );
}

function FontList({
    label,
    fonts,
    onFonts,
}: {
    label: string;
    fonts: readonly string[];
    onFonts(fonts: readonly string[]): void;
}) {
    const keys = useItemKeys(fonts.length);
    const reorder = (from: number, to: number) => {
        keys.move(from, to);
        onFonts(moveListItem(fonts, from, to));
    };

    return (
        <ol aria-label={label}>
            {fonts.map((name, index) => (
                <li key={keys.keys[index]}>
                    <input
                        aria-label={`${label}, font ${index + 1}`}
                        value={name}
                        onChange={(event) =>
                            onFonts(
                                fonts.map((each, at) => (at === index ? event.target.value : each)),
                            )
                        }
                    />{" "}
                    <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => reorder(index, index - 1)}
                    >
                        Up
                    </button>{" "}
                    <button
                        type="button"
                        disabled={index === fonts.length - 1}
                        onClick={() => reorder(index, index + 1)}
                    >
                        Down
                    </button>{" "}
                    <button
                        type="button"
                        disabled={fonts.length === 1}
                        onClick={() => {
                            keys.remove(index);
                            onFonts(removeListItem(fonts, index));
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
                        onFonts([...fonts, ""]);
                    }}
                >
                    Add font
                </button>
            </li>
        </ol>
    );
}
