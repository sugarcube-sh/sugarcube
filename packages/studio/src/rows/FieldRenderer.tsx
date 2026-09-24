"use client";

import { useState } from "react";
import { FieldLabel, FieldLabelCell, FieldReset, FieldRow, FieldValue } from "../inspector/Field";
import { renderControl } from "./render-control";
import type { Row } from "./types";

export function FieldRenderer({ row }: { row: Row }) {
    const [initialCount] = useState(row.controls.length);
    if (import.meta.env.DEV && initialCount !== row.controls.length) {
        throw new Error(
            `[studio] Bug in row "${row.key}": it had ${initialCount} input(s), then ${row.controls.length}. ` +
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
