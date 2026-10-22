import type { JsonPath, JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { dimensionUnits, durationUnits, strokeStyleKeywords } from "@sugarcube-sh/dtcg/values";
import { useContext, useId, useMemo } from "react";
import {
    type Draft,
    type Field,
    type FieldType,
    changes,
    draftFor,
    fieldFor,
    fieldFrom,
    hasField,
    says,
    weightKeywords,
    withPoint,
    writtenFor,
} from "../controllers/value-field";
import { moved, without } from "../controllers/lists";
import { hasParts } from "../controllers/parts";
import { referable } from "../controllers/views";
import { useStudioState } from "../providers/studio-context";
import { Choice } from "./Choice";
import { ColorInput } from "./ColorInput";
import { CompositeInput } from "./CompositeInput";
import { EditedTokenContext } from "../providers/edited-token-context";
import { JsonField } from "./JsonField";
import { useDraft, useItemKeys } from "./use-draft";

export function TypedField({
    type,
    written,
    label,
    references = true,
    onWrite,
}: {
    type: TokenType | undefined;
    written: JsonValue | undefined;
    label: string;
    references?: boolean;
    onWrite(value: JsonValue, part?: JsonPath, control?: string): void;
}) {
    const field = written === undefined ? undefined : fieldFor(type, written);
    const shown = written === undefined ? "" : JSON.stringify(written);
    const [side, setSide] = useDraft<"value" | "token">(
        field?.kind === "reference" ? "token" : "value",
        shown,
    );
    const name = useId();
    const write = (next: Field, control?: string) => {
        if (changes(next, written)) onWrite(writtenFor(next), undefined, control);
    };

    if (type === undefined || field?.kind === "json") {
        return <JsonField written={written} label={label} onWrite={onWrite} />;
    }

    return (
        <>
            {references && (
                <fieldset aria-label={label}>
                    <label>
                        <input
                            type="radio"
                            name={name}
                            checked={side === "value"}
                            onChange={() => setSide("value")}
                        />{" "}
                        Value
                    </label>{" "}
                    <label>
                        <input
                            type="radio"
                            name={name}
                            checked={side === "token"}
                            onChange={() => setSide("token")}
                        />{" "}
                        Token
                    </label>
                </fieldset>
            )}
            {references && side === "token" ? (
                <TokenInput
                    type={type}
                    label={label}
                    referred={field?.kind === "reference" ? field.path : undefined}
                    onPath={(to) => write({ kind: "reference", path: to })}
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
                <JsonField written={undefined} label={label} onWrite={onWrite} />
            )}
        </>
    );
}

function TokenInput({
    type,
    label,
    referred,
    onPath,
}: {
    type: TokenType;
    label: string;
    referred: string | undefined;
    onPath(path: string): void;
}) {
    const tokens = useStudioState((state) => state.tokens);
    const showing = useStudioState((state) => state.showing);
    const path = useContext(EditedTokenContext);
    const listed = useMemo(
        () => referable(tokens, showing, type, path),
        [tokens, showing, type, path],
    );
    const [text, setText] = useDraft(referred ?? "", referred ?? "");
    const list = useId();

    return (
        <>
            <input
                aria-label={`${label}, token`}
                list={list}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    if (listed.includes(event.target.value)) onPath(event.target.value);
                }}
            />
            <datalist id={list}>
                {listed.map((each) => (
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
        draftFor(type, field),
        field ? JSON.stringify(field) : "",
        (kept) => says(kept, field),
    );
    const change = (next: Draft, control?: string) => {
        setDraft(next);
        const made = fieldFrom(next);
        if (made) write(made, control);
    };

    switch (draft.kind) {
        case "dimension":
        case "duration":
            return (
                <>
                    <NumberBox
                        label={`${label}, amount`}
                        amount={draft.amount}
                        onAmount={(amount) => change({ ...draft, amount })}
                    />{" "}
                    <Choice
                        label={`${label}, unit`}
                        chosen={draft.unit}
                        choices={draft.kind === "dimension" ? dimensionUnits : durationUnits}
                        onChoose={(unit) => change({ ...draft, unit })}
                    />
                </>
            );
        case "number":
            return (
                <NumberBox
                    label={label}
                    amount={draft.amount}
                    onAmount={(amount) => change({ ...draft, amount })}
                />
            );
        case "fontWeight":
            return (
                <>
                    <Choice
                        label={label}
                        chosen={draft.choice}
                        choices={[...weightKeywords, "number"]}
                        names={{ number: "Number" }}
                        onChoose={(choice) => change({ ...draft, choice })}
                    />
                    {draft.choice === "number" && (
                        <>
                            {" "}
                            <NumberBox
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
                        <NumberBox
                            key={bezierPoints[index]}
                            label={`${label}, ${bezierPoints[index]}`}
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
                <Choice
                    label={label}
                    chosen={draft.keyword}
                    choices={strokeStyleKeywords}
                    onChoose={(keyword) => change({ ...draft, keyword })}
                />
            );
        case "color":
        case "hexColor": {
            const now = fieldFrom(draft) ?? field;
            return (
                <ColorInput
                    draft={draft}
                    shown={now?.kind === "color" ? now : undefined}
                    label={label}
                    onDraft={change}
                />
            );
        }
    }
}

const bezierPoints = ["P1x", "P1y", "P2x", "P2y"] as const;

function NumberBox({
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
    const items = useItemKeys(fonts.length);
    const reorder = (from: number, to: number) => {
        items.moved(from, to);
        onFonts(moved(fonts, from, to));
    };

    return (
        <ol aria-label={label}>
            {fonts.map((name, index) => (
                <li key={items.keys[index]}>
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
                            items.removed(index);
                            onFonts(without(fonts, index));
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
                        items.added();
                        onFonts([...fonts, ""]);
                    }}
                >
                    Add font
                </button>
            </li>
        </ol>
    );
}
