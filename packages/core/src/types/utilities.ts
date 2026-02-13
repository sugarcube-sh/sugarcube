export type DirectionalVariant = "top" | "right" | "bottom" | "left" | "x" | "y" | "full" | "all";

export type PropertyUtilityConfig = {
    /** Token path pattern (e.g., "space.*", "color.primary.*"). */
    source: string;
    /** Directional variants for spacing properties. */
    directions?: DirectionalVariant | DirectionalVariant[];
    /** Custom prefix for generated classes. */
    prefix?: string;
    /** Strip duplicate prefix (e.g., "text-text-quiet" → "text-quiet"). */
    stripDuplicates?: boolean;
};
