// A script that renames the `color.brand` group to `color.primary`, updates every reference to the
// tokens inside it, and saves the result to disk in one go.
import { read } from "@sugarcube-sh/dtcg/node";
import { commit, rename } from "@sugarcube-sh/dtcg-edit";
import { applyToDisk } from "@sugarcube-sh/dtcg-edit/node";

const source = { entryFile: "tokens/tokens.resolver.json" };
const tokens = await read(source.entryFile);
const done = commit(tokens, rename(tokens, "color.brand", "primary"));
if (done.tokens) await applyToDisk(source, { steps: [done] });
else if (done.refusal) showMessage(done.refusal.reason);
