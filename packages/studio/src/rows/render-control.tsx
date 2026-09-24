"use client";

import type { ReactNode } from "react";
import { ColorPicker } from "../components/controls/ColorPicker";
import { LiteralColorInput } from "../components/controls/LiteralColorInput";
import { NumberInput } from "../components/controls/NumberInput";
import { Picker } from "../components/controls/Picker";
import { SliderField } from "../components/controls/SliderField";
import { Switch } from "../components/controls/Switch";
import { TextInput } from "../components/controls/TextInput";
import type { LiteralColor } from "../tokens/color-shape";
import type { ColorValue } from "../tokens/color-value";
import type { Control, ControlState } from "./types";

export type Cell = {
    state:
        | ControlState<number>
        | ControlState<string>
        | ControlState<boolean>
        | ControlState<ColorValue>
        | ControlState<LiteralColor>;
    element: ReactNode;
};

export function renderControl(control: Control, key: string): Cell {
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
        case "literal-color": {
            const state = control.use();
            return {
                state,
                element: (
                    <LiteralColorInput
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
        case "text": {
            const state = control.use();
            return {
                state,
                element: (
                    <TextInput
                        key={key}
                        {...control.props}
                        value={state.value}
                        onChange={state.commit ?? state.set}
                        disabled={state.disabled}
                    />
                ),
            };
        }
    }
}
