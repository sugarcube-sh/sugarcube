import type { ExtensionForm } from "../controllers/adapter";
import { getFieldLabel, createSettingEdit } from "../controllers/forms";
import { formatValue } from "../controllers/value-field";
import { TypedField } from "./TypedField";
import { useEdit } from "./use-edit";

export function ExtensionFields({
    path,
    form,
    rowName,
}: {
    path: string;
    form: ExtensionForm;
    rowName: string | undefined;
}) {
    const edit = useEdit();
    const { write } = form;

    return (
        <fieldset>
            <legend>{form.label}</legend>
            <dl>
                {form.fields.map((field) => (
                    <div key={field.key}>
                        <dt>{field.label}</dt>
                        <dd>
                            {write ? (
                                <TypedField
                                    type={field.type}
                                    value={field.value}
                                    label={getFieldLabel(rowName, form.label, field.label)}
                                    references={false}
                                    onWrite={(value) => {
                                        const { result, options } = createSettingEdit(
                                            {
                                                path,
                                                form: form.label,
                                                key: field.key,
                                                row: rowName,
                                            },
                                            write,
                                            value,
                                        );
                                        edit.run(result, options);
                                    }}
                                />
                            ) : (
                                <code>{formatValue(field.type, field.value)}</code>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
            {edit.view}
        </fieldset>
    );
}
