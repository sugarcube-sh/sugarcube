// Removes the dim theme, and deletes its file too if the person says yes. Only a file that no other
// theme uses can be deleted this way.
import { removeContext } from "@sugarcube-sh/dtcg-edit";
import { applyToDisk, open } from "@sugarcube-sh/dtcg-edit/node";

declare function confirm(question: string): Promise<boolean>;

const project = await open("tokens/tokens.resolver.json");
const deleteFiles = await confirm("Also delete the files only the dim theme uses?");
const result = removeContext(project, "theme", "dim", { deleteFiles });
if ("ops" in result) {
    const saved = await applyToDisk(project, result.ops);
    if ("refused" in saved) showMessage(saved.refused.reason);
}
