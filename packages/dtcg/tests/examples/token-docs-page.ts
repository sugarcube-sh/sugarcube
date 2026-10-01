// A documentation page. It lists every token with its light and dark values, and which other tokens
// use it.
import { read } from "@sugarcube-sh/dtcg/node";
import { byToken, referrers } from "@sugarcube-sh/dtcg";

const doc = await read("tokens/tokens.resolver.json");

for (const t of byToken(doc)) {
    const light = t.permutations.default;
    const dark = t.permutations.dark;
    row(
        t.path,
        t.type,
        light?.resolved,
        dark?.resolved,
        referrers(doc, t.path).map((r) => r.path),
    );
}
