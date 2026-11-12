// Works out what a size is for, such as a font size or a border width, so an editor can show the
// right preview next to it. A setting on the token or on any group above it can say so, and so
// can being used as the font size of a typography token or the width of a border.
import { type DesignTokens, tokenPath } from "@sugarcube-sh/dtcg";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";

declare const tokens: DesignTokens;

function declared(path: string): string | undefined {
    const permutation = tokens.getPermutation();
    for (let at: string | undefined = path; at !== undefined; at = tokenPath.getParent(at)) {
        const found = permutation.getTokenOrGroup(at);
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
for (const t of tokens.getPermutation().tokens) {
    for (const { property = [], pointsToWholeToken: target } of t.references) {
        const measure = measures[`${t.type} ${property.join(".")}`];
        if (measure && target) usedAs.set(target.path, measure);
    }
}

export function measureOf(path: string): string | undefined {
    return declared(path) ?? usedAs.get(path);
}
