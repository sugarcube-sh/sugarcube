import type { ComponentProps } from "react";
import type { ColorPicker } from "../components/controls/ColorPicker";
import type { NumberInput } from "../components/controls/NumberInput";
import type { Picker } from "../components/controls/Picker";
import type { SliderField } from "../components/controls/SliderField";
import type { Switch } from "../components/controls/Switch";
import type { ColorValue } from "../tokens/color-value";
import type { Adapter, Control, RowProps } from "./types";

/**
 * Make a slider, picker, etc. control.
 *
 * Use these instead of writing the object by hand. That way if you pass a
 * slider option to a picker (or the other way around), you get an error now
 * instead of a silent no-op later.
 */

export function rangeControl(
    props: RowProps<ComponentProps<typeof SliderField>>,
    use: Adapter<number>,
): Control {
    return { editor: "range", props, use };
}

export function numberControl(
    props: RowProps<ComponentProps<typeof NumberInput>>,
    use: Adapter<number>,
): Control {
    return { editor: "number", props, use };
}

export function pickerControl(
    props: RowProps<ComponentProps<typeof Picker>>,
    use: Adapter<string>,
): Control {
    return { editor: "picker", props, use };
}

export function colorControl(
    props: RowProps<ComponentProps<typeof ColorPicker>>,
    use: Adapter<ColorValue>,
): Control {
    return { editor: "color", props, use };
}

export function switchControl(
    props: RowProps<ComponentProps<typeof Switch>>,
    use: Adapter<boolean>,
): Control {
    return { editor: "switch", props, use };
}
