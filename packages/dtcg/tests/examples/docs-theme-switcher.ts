// A theme switcher on a docs site. It shows every color in whichever theme the reader picks,
// falling back to the default.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { cssValue } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;
declare const picked: string;

const theme = tokens.resolver?.modifiers.find(({ name }) => name === "theme");
const known = theme?.contexts.some(({ name }) => name === picked);
const current = known ? tokens.permutation({ theme: picked }) : tokens.permutation();

for (const t of current.tokens) {
    if (t.type === "color") row(t.path, cssValue(t));
}
