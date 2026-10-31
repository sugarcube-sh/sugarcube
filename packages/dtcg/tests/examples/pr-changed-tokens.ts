// A pull request check. It compares the tokens on main with this branch, and comments on each token
// whose value changed and how many tokens depend on it.
import { read } from "@sugarcube-sh/dtcg";

const before = await read("tokens.resolver.json", { readText: fromGit("main") });
const after = await read("tokens.resolver.json", { readText: fromGit("HEAD") });

for (const change of after.diff(before)) {
    if (change.kind !== "changed" || !change.properties.includes("value")) continue;
    const users = after.permutations.flatMap((p) => p.usedBy(change.path));
    const dependents = new Set(users.map(({ path }) => path)).size;
    comment(`${change.path} changed; ${dependents} tokens depend on it`);
}
