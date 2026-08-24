"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { ColorPicker } from "../components/controls/ColorPicker";
import { NumberInput } from "../components/controls/NumberInput";
import { Picker } from "../components/controls/Picker";
import { SliderField } from "../components/controls/SliderField";
import { Switch } from "../components/controls/Switch";
import { FieldLabel, FieldLabelCell, FieldReset, FieldRow, FieldValue } from "../shell/Field";
import type { ColorValue } from "../tokens/color-value";
import type { Control, ControlState, Row } from "./types";

type Cell = {
    state:
        | ControlState<number>
        | ControlState<string>
        | ControlState<boolean>
        | ControlState<ColorValue>;
    element: ReactNode;
};

function renderControl(control: Control, key: string): Cell {
    switch (control.editor) {
        case "range": {
            const state = control.use();
            return {
                state,
                element: (
                    <SliderField
                        key={key}
                        {...control.props}
                        value={state.value}
                        onChange={state.set}
                        onCommit={state.commit}
                        disabled={state.disabled}
                    />
                ),
            };
        }
        case "number": {
            const state = control.use();
            return {
                state,
                element: (
                    <NumberInput
                        key={key}
                        {...control.props}
                        value={state.value}
                        onChange={state.commit ?? state.set}
                        disabled={state.disabled}
                    />
                ),
            };
        }
        case "picker": {
            const state = control.use();
            return {
                state,
                element: (
                    <Picker
                        key={key}
                        {...control.props}
                        value={state.value}
                        onChange={state.commit ?? state.set}
                        disabled={state.disabled}
                    />
                ),
            };
        }
        case "color": {
            const state = control.use();
            return {
                state,
                element: (
                    <ColorPicker
                        key={key}
                        {...control.props}
                        value={state.value}
                        onChange={state.commit ?? state.set}
                        disabled={state.disabled}
                    />
                ),
            };
        }
        case "switch": {
            const state = control.use();
            return {
                state,
                element: (
                    <Switch
                        key={key}
                        {...control.props}
                        checked={state.value}
                        onChange={state.commit ?? state.set}
                        disabled={state.disabled}
                    />
                ),
            };
        }
    }
}

export function FieldRenderer({ row }: { row: Row }) {
    const initialCount = useRef(row.controls.length);
    if (import.meta.env.DEV && initialCount.current !== row.controls.length) {
        throw new Error(
            `[studio] Bug in row "${row.key}": it had ${initialCount.current} input(s), then ${row.controls.length}. ` +
                "Each row must keep the same number of inputs forever. Something in expand() (or a scale/alias row builder) " +
                "is adding or removing controls after the first render.",
        );
    }

    const cells = row.controls.map((control, index) =>
        renderControl(control, `${row.key}#${index}`),
    );

    const first = cells[0]?.state;

    return (
        <FieldRow>
            <FieldLabelCell data-overridden={first?.overridden ? "" : undefined}>
                <FieldLabel>{row.label}</FieldLabel>
                {first?.overridden === undefined ? null : (
                    <FieldReset
                        onClick={first.reset}
                        disabled={!first.reset}
                        aria-label={`Discard change to ${row.label}`}
                        title="Discard"
                        style={first.reset ? undefined : { visibility: "hidden" }}
                        aria-hidden={first.reset ? undefined : true}
                        tabIndex={first.reset ? undefined : -1}
                    />
                )}
            </FieldLabelCell>
            <FieldValue>{cells.map((cell) => cell.element)}</FieldValue>
        </FieldRow>
    );
}
