"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useFieldRow } from "../../shell/Field";
import { useRafThrottle } from "../../use-raf-throttle";

type SliderFieldProps = {
    "value": number | undefined;
    "onChange": (value: number) => void;
    "onCommit"?: (value: number) => void;
    "min": number;
    "max": number;
    "step"?: number;
    "disabled"?: boolean;
    "formatValue"?: (value: number) => string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
};

function SliderField({
    value,
    onChange,
    onCommit,
    min,
    max,
    step,
    disabled,
    formatValue = String,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
}: SliderFieldProps) {
    const row = useFieldRow();
    const dragging = useRafThrottle(onChange);
    const commit = onCommit ?? onChange;

    const missing = value === undefined;
    const thumb = value ?? min;

    const span = max - min;
    const fill = missing || span <= 0 ? 0 : ((value - min) / span) * 100;

    return (
        <div data-slot="slider-field" className="slider-field">
            <SliderPrimitive.Root
                className="slider"
                value={[thumb]}
                min={min}
                max={max}
                step={step}
                disabled={disabled || missing}
                onValueChange={([next = thumb]) => dragging(next)}
                onValueCommit={([next = thumb]) => commit(next)}
            >
                <SliderPrimitive.Track
                    className="slider-track"
                    style={{ "--fill": `${fill}%` } as React.CSSProperties}
                >
                    <SliderPrimitive.Range className="slider-range" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb
                    className="slider-thumb"
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? row?.labelId)}
                    aria-valuetext={missing ? undefined : formatValue(value)}
                />
            </SliderPrimitive.Root>
            <output data-slot="slider-value" className="slider-value" aria-hidden>
                {missing ? "" : formatValue(value)}
            </output>
        </div>
    );
}

export { SliderField };
export type { SliderFieldProps };
