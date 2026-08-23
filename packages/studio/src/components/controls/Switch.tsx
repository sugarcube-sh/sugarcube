"use client";

import { useFieldRow } from "../../shell/Field";

type SwitchProps = {
    checked: boolean | undefined;
    onChange: (checked: boolean) => void;
    id?: string;
    disabled?: boolean;
};

function Switch({ checked, onChange, id, disabled }: SwitchProps) {
    const row = useFieldRow();

    return (
        <input
            id={id ?? row?.id}
            type="checkbox"
            // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- a native checkbox already exposes its checked state;
            role="switch"
            data-slot="switch"
            className="switch"
            checked={checked ?? false}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
        />
    );
}

export { Switch };
export type { SwitchProps };
