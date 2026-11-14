import type { JsonValue } from "@sugarcube-sh/dtcg";
import type { ExtensionForm } from "./adapter";
import { type Edit, createMergeKey } from "./undo";

export function getFieldLabel(row: string | undefined, form: string, field: string): string {
    return [row, form, field].filter((each) => each !== undefined).join(", ");
}

export interface SettingField {
    readonly path: string;
    readonly form: string;
    readonly key: string;
    readonly row: string | undefined;
}

export function createSettingEdit(
    { path, form, key, row }: SettingField,
    write: NonNullable<ExtensionForm["write"]>,
    value: JsonValue,
): Edit {
    return {
        result: write(key, value),
        options: { mergeKey: createMergeKey({ path, property: `${form} ${key}`, row }) },
    };
}
