import type { ColorScaleConfig, ResolvedTokens } from "@sugarcube-sh/core/client";
import type { ComponentProps } from "react";
import type { ColorPicker } from "../components/controls/ColorPicker";
import type { LiteralColorInput } from "../components/controls/LiteralColorInput";
import type { NumberInput } from "../components/controls/NumberInput";
import type { Picker } from "../components/controls/Picker";
import type { SliderField } from "../components/controls/SliderField";
import type { Switch } from "../components/controls/Switch";
import type { TextInput } from "../components/controls/TextInput";
import type { LiteralColor } from "../tokens/color-shape";
import type { ColorValue } from "../tokens/color-value";
import type { PathIndex } from "../tokens/path-index";
import type { TokenSnapshot } from "../tokens/types";

export type ControlState<T> = {
    value: T | undefined;
    set: (next: T) => void;
    commit?: (next: T) => void;
    disabled?: boolean;
    overridden?: boolean;
    reset?: () => void;
};

/**
 * An Adapter is a HOOK. It may call useToken/useScaleState and therefore must never
 * be called conditionally, in a loop, or after an early return.
 *
 * That constraint is the whole design, not an implementation detail: because a row
 * calls a fixed set of adapters, its control count is fixed per binding and can't
 * vary with the data. A row whose length depends on the tokens - a Steps row with one
 * input per step - cannot be N adapters chosen at render time. It has to be a single
 * `Adapter<number[]>` that owns the whole array, so the hook count stays constant
 * however many steps there are.
 */
export type Adapter<T> = () => ControlState<T>;

/**
 * The controls FieldRenderer can render.
 */
export type EditorName =
    | "color"
    | "literal-color"
    | "picker"
    | "number"
    | "range"
    | "switch"
    | "text";

/**
 * The props FieldRenderer derives from the adapter.
 */
type AdapterDriven = "value" | "checked" | "onChange" | "onCommit" | "disabled";

export type RowProps<P> = Omit<P, AdapterDriven>;

/**
 * A control, keyed on its editor.
 */
export type Control =
    | {
          editor: "range";
          props: RowProps<ComponentProps<typeof SliderField>>;
          use: Adapter<number>;
      }
    | {
          editor: "number";
          props: RowProps<ComponentProps<typeof NumberInput>>;
          use: Adapter<number>;
      }
    | {
          editor: "picker";
          props: RowProps<ComponentProps<typeof Picker>>;
          use: Adapter<string>;
      }
    | {
          editor: "color";
          props: RowProps<ComponentProps<typeof ColorPicker>>;
          use: Adapter<ColorValue>;
      }
    | {
          editor: "literal-color";
          props: RowProps<ComponentProps<typeof LiteralColorInput>>;
          use: Adapter<LiteralColor>;
      }
    | {
          editor: "switch";
          props: RowProps<ComponentProps<typeof Switch>>;
          use: Adapter<boolean>;
      }
    | {
          editor: "text";
          props: RowProps<ComponentProps<typeof TextInput>>;
          use: Adapter<string>;
      };

export type Row = {
    key: string;
    label: string;
    controls: Control[];
};

export type ResolveContext = {
    baseline: TokenSnapshot;
    pathIndex: PathIndex;
    context: string;
    colorScale: ColorScaleConfig | undefined;
    resolved: ResolvedTokens;
};
