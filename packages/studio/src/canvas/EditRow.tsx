import type { TokenType } from "@sugarcube-sh/dtcg";
import type { ExtensionForm } from "../controllers/adapter";
import { type TokenPageRow, createValueEdit } from "../controllers/token-page";
import { useStudio } from "../providers/studio-context";
import { EditedTokenContext } from "../providers/edited-token-context";
import { ExtensionFields } from "./ExtensionFields";
import { TypedField } from "./TypedField";
import { useEdit } from "./use-edit";

export function EditRow({
    row,
    type,
    path,
    form,
}: {
    row: TokenPageRow;
    type: TokenType | undefined;
    path: string;
    form: ExtensionForm | undefined;
}) {
    const studio = useStudio();
    const edit = useEdit();

    return (
        <>
            <dt>{row.name}</dt>
            <dd>
                <EditedTokenContext.Provider value={path}>
                    <TypedField
                        type={type}
                        value={row.value}
                        label={row.fieldLabel}
                        onWrite={(next, part, control) => {
                            const { result, options } = createValueEdit(
                                studio.state.tokens,
                                path,
                                row,
                                next,
                                part,
                                control,
                            );
                            edit.run(result, options);
                        }}
                    />
                    {edit.view}
                    {form && <ExtensionFields path={path} form={form} rowName={row.name} />}
                </EditedTokenContext.Provider>
            </dd>
        </>
    );
}
