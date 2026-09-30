// Works out what a size is for, such as a font size or a border width, so an editor can show the
// right preview next to it. A setting on the token or on any group above it can say so, and so
// can being used as the font size of a typography token or the width of a border.
import {
    defaultPermutation,
    group,
    isAlias,
    isPointer,
    token,
    type Document,
} from "@sugarcube-sh/dtcg";

declare const doc: Document;

function declared(path: string): string | undefined {
    const parts = path.split(".");
    for (let depth = parts.length; depth > 0; depth--) {
        const at = parts.slice(0, depth).join(".");
        const extensions =
            depth === parts.length ? token(doc, at)?.extensions : group(doc, at)?.extensions;
        const setting = extensions?.["com.example"] as { measures?: string } | undefined;
        if (setting?.measures) return setting.measures;
    }
    return undefined;
}

const usedAs = new Map<string, string>();
for (const t of Object.values(defaultPermutation(doc)?.tokens ?? {})) {
    if (t.type === "typography" && t.value && !isAlias(t.value) && !isPointer(t.value)) {
        if (isAlias(t.value.fontSize)) usedAs.set(t.value.fontSize.alias, "font-size");
        if (isAlias(t.value.letterSpacing))
            usedAs.set(t.value.letterSpacing.alias, "letter-spacing");
    }
    if (
        t.type === "border" &&
        t.value &&
        !isAlias(t.value) &&
        !isPointer(t.value) &&
        isAlias(t.value.width)
    ) {
        usedAs.set(t.value.width.alias, "border-width");
    }
}

export function measureOf(path: string): string | undefined {
    return declared(path) ?? usedAs.get(path);
}
