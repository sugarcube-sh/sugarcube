export type DirectionalVariant = "top" | "right" | "bottom" | "left" | "x" | "y" | "full" | "all";

export type PropertyUtilityConfig = {
    /** Token path pattern (e.g., "space.*", "color.primary.*"). */
    readonly source: string;
    /** Directional variants for spacing properties. */
    readonly directions?: DirectionalVariant | readonly DirectionalVariant[];
    /** Custom prefix for generated classes. */
    readonly prefix?: string;
    /** Strip duplicate prefix (e.g., "text-text-quiet" → "text-quiet"). */
    readonly stripDuplicates?: boolean;
    /**
     * Force-generate classes regardless of markup usage (non-JIT).
     * - omitted / `false` — on-demand only (default).
     * - `true` — emit the whole family: every token under `source`.
     * - `string[]` — emit only the listed `*`-slot values, reusing this
     *   entry's own `source` / `prefix` / `directions`.
     */
    readonly safelist?: boolean | readonly string[];
};
