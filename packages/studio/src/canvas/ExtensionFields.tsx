import type { ExtensionForm } from "../controllers/adapter";
import { fieldName } from "../controllers/forms";
import { fieldKey } from "../controllers/undo";
import { fieldText } from "../controllers/value-field";
import { TypedField } from "./TypedField";
import { useEdit } from "./use-edit";

export function ExtensionFields({
    path,
    form,
    label,
}: {
    path: string;
    form: ExtensionForm;
    label: string | undefined;
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
                                    written={field.value}
                                    label={fieldName(label, form.label, field.label)}
                                    references={false}
                                    onWrite={(value) =>
                                        edit.run(write(field.key, value), {
                                            merge: fieldKey({
                                                path,
                                                writes: `${form.label} ${field.key}`,
                                                place: label,
                                            }),
                                        })
                                    }
                                />
                            ) : (
                                <code>{fieldText(field.type, field.value)}</code>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
            {edit.view}
        </fieldset>
    );
}
