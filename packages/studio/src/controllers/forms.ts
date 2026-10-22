import type { JsonValue } from "@sugarcube-sh/dtcg";
import type { ExtensionForm } from "./adapter";
import { type Edit, fieldKey } from "./undo";

export function fieldName(row: string | undefined, form: string, field: string): string {
    return [row, form, field].filter((each) => each !== undefined).join(", ");
}

export interface SettingField {
    readonly path: string;
    readonly form: string;
    readonly key: string;
    readonly row: string | undefined;
}

export function settingEdit(
    { path, form, key, row }: SettingField,
    write: NonNullable<ExtensionForm["write"]>,
    value: JsonValue,
): Edit {
    return {
        result: write(key, value),
        options: { merge: fieldKey({ path, writes: `${form} ${key}`, place: row }) },
    };
}
