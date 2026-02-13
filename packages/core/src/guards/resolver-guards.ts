/**
 * Check if an object is a reference (has $ref property).
 */
export function isReference(value: unknown): value is { $ref: string } {
    return (
        typeof value === "object" &&
        value !== null &&
        "$ref" in value &&
        typeof (value as Record<string, unknown>).$ref === "string"
    );
}

/**
 * Type guard for inline set in resolutionOrder.
 */
export function isInlineSet(
    item: unknown
): item is { type: "set"; name: string; sources: unknown[] } {
    return (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as { type: string }).type === "set"
    );
}

/**
 * Type guard for inline modifier in resolutionOrder.
 */
export function isInlineModifier(item: unknown): item is {
    type: "modifier";
    name: string;
    contexts: Record<string, unknown[]>;
    default?: string;
} {
    return (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item as { type: string }).type === "modifier"
    );
}
