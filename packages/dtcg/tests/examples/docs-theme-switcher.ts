// A theme switcher on a docs site. It shows every color in whichever theme the reader picks,
// falling back to the default.
import { permutation, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare const picked: string;

const themes = doc.modifiers["theme"]?.contexts ?? [];
const current = permutation(doc, {
    theme: themes.includes(picked) ? picked : (doc.modifiers["theme"]?.default ?? ""),
});
for (const t of Object.values(current?.tokens ?? {})) {
    if (t.type === "color") row(t.path, t.resolved?.hex);
}
