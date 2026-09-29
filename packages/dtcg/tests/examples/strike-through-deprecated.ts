// A code editor striking through references to deprecated tokens, with the reason.
import type { Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

for (const d of doc.diagnostics) {
    if (d.kind === "deprecated-reference" && d.tags?.includes("deprecated") && d.at) {
        report(
            d.at,
            `${d.detail.ref} is deprecated${d.detail.reason ? `: ${d.detail.reason}` : ""}`,
        );
    }
}
