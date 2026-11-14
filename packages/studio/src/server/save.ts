import type { TokensOnDisk } from "@sugarcube-sh/dtcg/node";
import { isEdits } from "@sugarcube-sh/dtcg-edit";
import { applyToDisk } from "@sugarcube-sh/dtcg-edit/node";
import { ErrorMessages } from "../error-messages";
import type { SaveResult } from "../protocol";

export async function saveEdits(onDisk: TokensOnDisk, payload: unknown): Promise<SaveResult> {
    if (!isEdits(payload)) throw new Error(ErrorMessages.NOT_EDITS);
    const applyResult = await applyToDisk(onDisk, payload);
    if (applyResult.conflicts) return { conflicts: applyResult.conflicts };
    return { savedFiles: Object.keys(applyResult.textByFile), deleted: applyResult.deleted };
}
