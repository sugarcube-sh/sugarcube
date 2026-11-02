// A theme switcher on a docs site. It shows every color in whichever theme the reader picks,
// falling back to the default.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { toCSSValue } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;
declare const picked: string;

const theme = tokens.resolver?.modifiers.find(({ name }) => name === "theme");
const known = theme?.contexts.some(({ name }) => name === picked);
const current = known ? tokens.getPermutation({ theme: picked }) : tokens.getPermutation();

for (const t of current.tokens) {
    if (t.type === "color") row(t.path, toCSSValue(t));
}
