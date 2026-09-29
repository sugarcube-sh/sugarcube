// Finds the project's resolver file. It says which one it's using, or asks you to pick if there are
// several.
import { findResolver } from "@sugarcube-sh/dtcg/node";

const found = await findResolver(process.cwd());
if (found.kind === "one") showMessage(`Using ${found.path}`);
else if (found.kind === "many")
    showMessage(`Several resolvers: ${found.paths.join(", ")}. Pick one in your config.`);
else showMessage("No resolver found. Run `sugarcube init`.");
