import type { TokenType } from "@sugarcube-sh/dtcg";
import { setValue } from "@sugarcube-sh/dtcg-edit";
import type { ExtensionForm } from "../controllers/adapter";
import type { ValueRow } from "../controllers/token-page";
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
    row: ValueRow;
    type: TokenType | undefined;
    path: string;
    form: ExtensionForm | undefined;
}) {
    const studio = useStudio();
    const edit = useEdit();
    const label = row.unwritten ? `Override for ${row.label}` : row.label;

    return (
        <>
            <dt>{label}</dt>
            <dd>
                <EditedTokenContext.Provider value={path}>
                    <TypedField
                        type={type}
                        written={row.value}
                        label={label ?? path}
                        onWrite={(next, part) =>
                            edit.run(
                                setValue(studio.state.tokens, path, next, { ...row.where, part }),
                            )
                        }
                    />
                    {edit.view}
                    {form && <ExtensionFields form={form} label={label} />}
                </EditedTokenContext.Provider>
            </dd>
        </>
    );
}
