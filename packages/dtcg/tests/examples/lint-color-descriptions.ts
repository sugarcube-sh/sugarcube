// A lint rule that flags every color token without a description.
import { byToken, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

for (const t of byToken(doc)) {
    const base = t.default;
    if (base?.type === "color" && !base.description)
        report(base.source.at, `${t.path} has no description`);
}
