// A table of every color in every combination of theme and brand: light and dark, default brand and
// ocean.
import { read } from "@sugarcube-sh/dtcg";

const tokens = await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    inputs: [{}, { theme: "dark" }, { brand: "ocean" }, { theme: "dark", brand: "ocean" }],
});

row("", ...tokens.permutations.map((p) => p.label));
for (const path of tokens.getTokenPaths()) {
    const each = tokens.permutations.map((p) => p.getToken(path));
    if (each.some((t) => t?.type === "color")) row(path, ...each.map((t) => t?.resolved));
}
const darkOcean = tokens.getPermutation({ theme: "dark", brand: "ocean" });
showMessage(`${darkOcean.tokens.length} tokens in ${darkOcean.label}`);
