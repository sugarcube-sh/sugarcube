// A script that renames the `color.brand` group to `color.primary`, updates every reference to the
// tokens inside it, and saves the result to disk in one go.
import { commit, rename } from "@sugarcube-sh/dtcg-edit";
import { applyToDisk, open } from "@sugarcube-sh/dtcg-edit/node";

const project = await open("tokens/tokens.resolver.json");
const done = commit(project, rename(project, "color.brand", "primary"));
if ("project" in done) await applyToDisk(project, done.ops);
else if ("refused" in done) showMessage(done.refused.reason);
