// When the dark theme changes one color, finds every token that depends on it, directly or through
// others, so each can be restated for dark.
import { referrers, type Document, type Input } from "@sugarcube-sh/dtcg";

declare const doc: Document;
const dark: Input = { theme: "dark" };

const restate = referrers(doc, "color.brand", dark, { transitive: true }).map((r) => r.path);
row(restate.join(", "));
