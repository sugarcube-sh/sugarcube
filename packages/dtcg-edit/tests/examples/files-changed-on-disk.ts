// The token files change on disk while the token editor has unsaved changes, because someone
// pulled new commits or edited a file in their code editor. The unsaved changes are put back on
// top of the new files. One that touches something which also changed is reported as a conflict,
// not written over the other change.
import { open, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare function readText(path: string): Promise<string>;

export async function onFilesChanged(): Promise<void> {
    const conflicts = session.adopt(await open("tokens.resolver.json", { readText }));
    if (conflicts.length) showConflicts(conflicts);
}
