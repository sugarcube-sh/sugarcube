// Works out what a size is for, such as a font size or a border width, so an editor can show the
// right preview next to it. A setting on the token or on any group above it can say so, and so
// can being used as the font size of a typography token or the width of a border.
import { type DesignTokens, parentOf } from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";

declare const tokens: DesignTokens;

function declared(path: string): string | undefined {
    const permutation = tokens.permutation();
    for (let at: string | undefined = path; at !== undefined; at = parentOf(at)) {
        const found = permutation.token(at) ?? permutation.group(at);
        const setting = found?.extensions?.["com.example"];
        if (isJsonObject(setting) && typeof setting.measures === "string") return setting.measures;
    }
    return undefined;
}

const measures: Record<string, string> = {
    "typography fontSize": "font-size",
    "typography letterSpacing": "letter-spacing",
    "border width": "border-width",
};

const usedAs = new Map<string, string>();
for (const t of tokens.permutation().tokens) {
    for (const { property = [], token: target } of t.references) {
        const measure = measures[`${t.type} ${property.join(".")}`];
        if (measure && target) usedAs.set(target.path, measure);
    }
}

export function measureOf(path: string): string | undefined {
    return declared(path) ?? usedAs.get(path);
}
