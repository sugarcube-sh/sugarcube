// When the dark theme changes one color, finds every token that depends on it, directly or through
// others, so each can be restated for dark.
import { type DesignTokens } from "@sugarcube-sh/dtcg";

declare const tokens: DesignTokens;
const dark = tokens.getPermutation({ theme: "dark" });

const restate = dark.getDependents("color.brand", { chained: true }).map(({ path }) => path);
row(restate.join(", "));
