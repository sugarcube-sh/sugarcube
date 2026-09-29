// Applies the safe fixes by itself, and asks a person before applying the rest.
import { errors, type Fix, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare function applyEdits(fix: Fix): Promise<void>;
declare function confirm(question: string): Promise<boolean>;

for (const d of errors(doc)) {
    for (const fix of d.fixes ?? []) {
        if (fix.safe) await applyEdits(fix);
        else if (await confirm(`${d.message}: ${fix.title}?`)) await applyEdits(fix);
    }
}
