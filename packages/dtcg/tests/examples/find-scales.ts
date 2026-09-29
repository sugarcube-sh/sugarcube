// Finds the scales in a design system: groups whose steps are made by a generator, and groups
// written out by hand whose tokens are all sizes.
import { defaultPermutation, tokensIn, type Document } from "@sugarcube-sh/dtcg";

declare const doc: Document;

for (const group of Object.values(defaultPermutation(doc)?.groups ?? {})) {
    if (group.extensions?.["com.example.scale"]) {
        row(group.path, "made by a generator");
        continue;
    }
    const tokens = tokensIn(doc, group.path);
    if (tokens.length > 1 && tokens.every((t) => t.type === "dimension" && !t.generated)) {
        row(group.path, "written by hand");
    }
}
