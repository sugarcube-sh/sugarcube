// A pull request check. It compares the tokens on main with this branch, and comments on each token
// whose value changed and how many tokens depend on it.
import { read, diff, referrers } from "@sugarcube-sh/dtcg";

const before = await read("tokens.resolver.json", { readText: fromGit("main") });
const after = await read("tokens.resolver.json", { readText: fromGit("HEAD") });

for (const change of diff(before, after)) {
    if (change.kind !== "changed" || !change.properties.includes("value")) continue;
    comment(`${change.path} changed; ${referrers(after, change.path).length} tokens depend on it`);
}
