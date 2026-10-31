// A documentation page. It lists every token with its light and dark values, and which other tokens
// use it in any permutation: every token in any of them.
import { read } from "@sugarcube-sh/dtcg/node";

const tokens = await read("tokens/tokens.resolver.json");

const light = tokens.permutation({ theme: "light" });
const dark = tokens.permutation({ theme: "dark" });

for (const path of tokens.tokenPaths()) {
    const inLight = light.token(path);
    const inDark = dark.token(path);
    const users = new Set(
        tokens.permutations.flatMap((p) => p.usedBy(path)).map((user) => user.path),
    );
    row(path, (inLight ?? inDark)?.type, inLight?.resolved, inDark?.resolved, [...users]);
}
