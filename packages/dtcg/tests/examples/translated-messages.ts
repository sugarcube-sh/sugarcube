// Shows problems in French, worded by the tool itself from each problem's details rather than from
// the English message.
import type { Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

for (const d of doc.diagnostics) {
    switch (d.kind) {
        case "missing-reference":
            showMessage(
                `Le jeton ${d.detail.ref} n'existe pas (utilisé par ${d.detail.referencedBy.join(", ")})`,
            );
            break;
        case "unknown-type":
            showMessage(`Type inconnu « ${d.detail.type} »`);
            break;
        case "circular-reference":
            showMessage(`Référence circulaire : ${d.detail.chain.join(" → ")}`);
            break;
        default:
            showMessage(d.message);
    }
}
