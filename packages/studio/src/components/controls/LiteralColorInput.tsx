"use client";

import { useEffect, useRef, useState } from "react";
import type { LiteralColor } from "../../tokens/color-shape";
import { useFieldRow } from "../../inspector/Field";
import { FieldTrigger, FieldTriggerContent, FieldTriggerPlaceholder } from "./FieldTrigger";
import { Swatch } from "./Swatch";

type ColorInputElement = HTMLElement & {
    value: string;
    colorspace: string;
    noAlpha: boolean;
};

type ChangeDetail = {
    value: string;
    colorspace: string;
    gamut: string;
};

let pending: Promise<unknown> | undefined;

function loadColorInput(): Promise<unknown> {
    pending ??= import("hdr-color-input");
    return pending;
}

type LiteralColorInputProps = {
    value: LiteralColor | undefined;
    onChange: (value: LiteralColor) => void;
    id?: string;
    disabled?: boolean;
};

export function LiteralColorInput({ value, onChange, id, disabled }: LiteralColorInputProps) {
    const row = useFieldRow();
    const ref = useRef<ColorInputElement | null>(null);
    const [ready, setReady] = useState(false);

    const pushed = useRef<string | undefined>(undefined);

    useEffect(() => {
        let live = true;
        loadColorInput().then(() => {
            if (live) setReady(true);
        });
        return () => {
            live = false;
        };
    }, []);

    useEffect(() => {
        const element = ref.current;
        if (!ready || !element || !value) return;
        if (pushed.current === value.css) return;

        pushed.current = value.css;
        element.value = value.css;

        // This gets around a current bug in hdr-color-input. Reproduced upstream in
        // 0.4.2 and 0.4.3. Drop this line when it is fixed.
        element.colorspace = value.space;
    }, [ready, value]);

    useEffect(() => {
        const element = ref.current;
        if (!ready || !element || !value) return;

        const handle = (event: Event) => {
            const detail = (event as CustomEvent<ChangeDetail>).detail;
            if (!detail?.value) return;

            pushed.current = undefined;

            if (detail.colorspace !== value.space) {
                element.colorspace = value.space;
                return;
            }

            onChange({ ...value, css: detail.value });
        };

        element.addEventListener("change", handle);
        return () => element.removeEventListener("change", handle);
    }, [ready, onChange, value]);

    if (!ready || disabled) {
        return (
            <FieldTrigger id={id} disabled aria-labelledby={row?.labelId}>
                <FieldTriggerContent>
                    {value ? (
                        <>
                            <Swatch color={value.css} />
                            <span className="token-text">{value.css}</span>
                        </>
                    ) : (
                        <FieldTriggerPlaceholder>No value</FieldTriggerPlaceholder>
                    )}
                </FieldTriggerContent>
            </FieldTrigger>
        );
    }

    return (
        <color-input ref={ref} id={id} class="literal-color-input" aria-labelledby={row?.labelId} />
    );
}

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "color-input": React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            > & {
                ref?: React.Ref<ColorInputElement | null>;
                class?: string;
            };
        }
    }
}

export type { LiteralColorInputProps };
