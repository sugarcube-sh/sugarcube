export type FontFamilyValue = {
    /** The stack as one comma-separated line */
    text: string;
    /** Whether the token holds an array */
    list: boolean;
};

export function readFontFamily(value: unknown): FontFamilyValue | undefined {
    if (typeof value === "string") {
        return value.startsWith("{") ? undefined : { text: value, list: false };
    }

    if (Array.isArray(value) && value.every((family) => typeof family === "string")) {
        return { text: value.join(", "), list: true };
    }

    return undefined;
}

export function writeFontFamily(text: string, list: boolean): string | string[] | undefined {
    const families = text
        .split(",")
        .map((family) => family.trim())
        .filter(Boolean);

    if (families.length === 0) return undefined;

    return list || families.length > 1 ? families : (families[0] as string);
}
