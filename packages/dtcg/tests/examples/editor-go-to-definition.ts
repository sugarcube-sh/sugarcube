// A code editor feature. Click a reference like `{color.brand}` to jump to that token, and get
// suggestions of tokens of the right type as you type one.
import { at, token, byToken, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

const hit = at(doc, "tokens.json", 214);
if (hit.kind === "reference") {
    const target = token(doc, hit.to, hit.permutation);
    if (target) goTo(target.source.node);
}

const here = at(doc, "tokens.json", 380);
const expects = here.kind === "reference" || here.kind === "token" ? here.expects : undefined;
export const options = Object.values(byToken(doc)).filter((t) => !expects || t.type === expects);
