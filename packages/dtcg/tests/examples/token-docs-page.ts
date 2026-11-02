// A documentation page. It lists every token with its light and dark values, and which other tokens
// use it in any permutation: every token in any of them.
import { read } from "@sugarcube-sh/dtcg/node";

const tokens = await read("tokens/tokens.resolver.json");

const light = tokens.getPermutation({ theme: "light" });
const dark = tokens.getPermutation({ theme: "dark" });

for (const path of tokens.getTokenPaths()) {
    const inLight = light.getToken(path);
    const inDark = dark.getToken(path);
    const users = new Set(
        tokens.getReferencesTo(path).flatMap(({ writtenInPaths: fromPaths }) => fromPaths),
    );
    row(path, (inLight ?? inDark)?.type, inLight?.resolved, inDark?.resolved, [...users]);
}
